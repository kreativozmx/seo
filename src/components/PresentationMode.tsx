"use client";

import { useEffect, useRef, useState } from "react";

// Floating toggle for "presentation mode": 4x zoom + a laser-pointer
// cursor, meant for screen-sharing on a call. Mounted once in the root
// layout so it's available on every page and its state survives client
// navigation.
//
// The toggle button and the laser dot are rendered OUTSIDE the zoomed
// #presentation-content wrapper on purpose. Mouse events (clientX/clientY)
// always report real, unzoomed viewport pixels, so a sibling fixed
// element tracks the cursor correctly and stays a normal, clickable size
// no matter the zoom level — a descendant of the zoomed wrapper would
// both drift and balloon to 4x itself.
export function PresentationModeToggle() {
  const [active, setActive] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.getElementById("presentation-content");
    root?.classList.toggle("presentation-zoom", active);
    document.body.classList.toggle("presentation-cursor-none", active);
    if (!active) return;

    function onMove(e: MouseEvent) {
      const dot = dotRef.current;
      if (!dot) return;
      dot.style.transform = `translate(${e.clientX - 13}px, ${e.clientY - 13}px)`;
    }
    function onClick(e: MouseEvent) {
      const ripple = document.createElement("div");
      ripple.className = "presentation-laser-ripple";
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [active]);

  useEffect(() => {
    function onShortcut(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "l" && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        setActive((a) => !a);
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  return (
    <>
      <button
        onClick={() => setActive((a) => !a)}
        title={`${active ? "Salir del" : "Activar"} modo presentación (Ctrl+Shift+L) — zoom x4 y puntero laser para videollamadas`}
        aria-pressed={active}
        className={`fixed bottom-5 right-5 z-[10001] w-11 h-11 rounded-full shadow-lg border flex items-center justify-center transition-colors ${
          active
            ? "bg-red-600 border-red-600 text-white"
            : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="9" strokeDasharray="2 3" />
        </svg>
      </button>
      {active && <div ref={dotRef} className="presentation-laser-dot" />}
    </>
  );
}
