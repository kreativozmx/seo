"use client";

import { useEffect, useRef, useState } from "react";

// "Presentation mode": a magnifying-glass lens that follows the cursor,
// meant for pointing things out while screen-sharing on a call. Mounted
// once in the root layout so it's available on every page and its state
// survives client navigation.
//
// How the lens works: rather than zooming the whole page (which used to
// distort layout and made fixed elements balloon to the zoom level too),
// it clones #presentation-content into a hidden "mirror" copy, scales
// that clone with a CSS transform, and clips it to a small circle
// (border-radius: 50% + overflow: hidden) positioned at the cursor. The
// clone is refreshed on an interval so it doesn't go stale as the
// dashboard's own data loads, and repositioned/retranslated on every
// mousemove so the point under the cursor always lines up with the
// content shown inside the lens.
//
// The lens and toggle controls are rendered as siblings of
// #presentation-content (not descendants), so mouse coordinates
// (clientX/clientY, always real unzoomed viewport pixels) map directly
// onto them without any correction.
const ZOOM_LEVELS = [1, 2, 4] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];
const LENS_SIZE = 260;

export function PresentationModeToggle() {
  const [active, setActive] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>(2);
  const lensRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.toggle("presentation-cursor-none", active);
    if (!active) return;

    const source = document.getElementById("presentation-content");
    const lens = lensRef.current;
    const mirror = mirrorRef.current;
    if (!source || !lens || !mirror) return;

    function refreshMirror() {
      if (!source || !mirror) return;
      const rect = source.getBoundingClientRect();
      mirror.style.width = `${rect.width}px`;
      mirror.innerHTML = "";
      const clone = source.cloneNode(true) as HTMLElement;
      clone.removeAttribute("id");
      mirror.appendChild(clone);
    }
    refreshMirror();
    const refreshInterval = setInterval(refreshMirror, 800);

    function onMove(e: MouseEvent) {
      if (!source || !lens || !mirror) return;
      const half = LENS_SIZE / 2;
      lens.style.transform = `translate(${e.clientX - half}px, ${e.clientY - half}px)`;

      const rect = source.getBoundingClientRect();
      const xInSource = e.clientX - rect.left;
      const yInSource = e.clientY - rect.top;
      mirror.style.transform = `translate(${half - xInSource * zoom}px, ${half - yInSource * zoom}px) scale(${zoom})`;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [active, zoom]);

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
      <div className="fixed bottom-5 right-5 z-[10001] flex items-center gap-2">
        <div className="flex bg-white border border-neutral-200 rounded-full shadow-lg p-1 gap-0.5">
          {ZOOM_LEVELS.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              title={`Lupa a ${z}x`}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                zoom === z ? "bg-red-600 text-white" : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              {z}x
            </button>
          ))}
        </div>
        <div className="group relative">
          <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-max max-w-[220px] rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            <p className="font-medium">Modo presentación</p>
            <p className="text-neutral-300">Lupa para señalar en videollamadas (Ctrl+Shift+L)</p>
            <span className="absolute -bottom-1 right-4 h-2 w-2 rotate-45 bg-neutral-900" />
          </div>
          <button
            onClick={() => setActive((a) => !a)}
            aria-pressed={active}
            aria-label="Modo presentación"
            className={`w-11 h-11 rounded-full shadow-lg border flex items-center justify-center transition-colors ${
              active
                ? "bg-red-600 border-red-600 text-white"
                : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>
      {active && (
        <div ref={lensRef} className="presentation-lens">
          <div ref={mirrorRef} className="presentation-lens-mirror" />
        </div>
      )}
    </>
  );
}
