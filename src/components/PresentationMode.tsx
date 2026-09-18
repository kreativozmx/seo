"use client";

import { useEffect, useState } from "react";

// "Presentation mode": for screen-sharing on a call. Toggling it (1) zooms
// the whole page to a chosen level via CSS zoom, so text/UI read clearly
// over a shared screen, (2) hides anything marked `data-presentation-hide`
// (the dashboard sidebar, see ProjectDashboard.tsx's <aside>) so the extra
// width goes to the actual content instead, and (3) swaps the mouse cursor
// for a red laser-pointer dot so viewers on the call can follow where
// you're pointing. Mounted once in the root layout so it's available on
// every page and its state survives client navigation.
//
// An earlier version tried a magnifying-glass lens that cloned and
// re-scaled the DOM under the cursor — dropped because it wasn't actually
// useful in practice; a plain page zoom + laser dot is simpler and does
// the job.
const ZOOM_LEVELS = [100, 125, 150, 175, 200] as const;
type ZoomLevel = (typeof ZOOM_LEVELS)[number];
const DEFAULT_ZOOM: ZoomLevel = 125;

export function PresentationModeToggle() {
  const [active, setActive] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>(DEFAULT_ZOOM);

  useEffect(() => {
    document.body.classList.toggle("presentation-active", active);
    document.body.classList.toggle("presentation-cursor-none", active);
    const content = document.getElementById("presentation-content");
    if (content) {
      content.style.zoom = active ? String(zoom / 100) : "";
    }
  }, [active, zoom]);

  useEffect(() => {
    if (!active) return;

    const dot = document.createElement("div");
    dot.className = "presentation-laser-dot";
    document.body.appendChild(dot);

    function onMove(e: MouseEvent) {
      dot.style.transform = `translate(${e.clientX - 13}px, ${e.clientY - 13}px)`;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      dot.remove();
      window.removeEventListener("mousemove", onMove);
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
    <div className="fixed bottom-5 right-5 z-[10001] flex items-center gap-2">
      {active && (
        <div className="flex bg-white border border-neutral-200 rounded-full shadow-lg p-1 gap-0.5">
          {ZOOM_LEVELS.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              title={`Zoom ${z}%`}
              className={`px-2 h-8 rounded-full text-[11px] font-medium transition-colors ${
                zoom === z ? "bg-red-600 text-white" : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              {z}%
            </button>
          ))}
        </div>
      )}
      <div className="group relative">
        <div className="pointer-events-none absolute bottom-full right-0 mb-2 w-max max-w-[220px] rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          <p className="font-medium">Modo presentación</p>
          <p className="text-neutral-300">
            Cursor laser + zoom de pantalla para videollamadas (Ctrl+Shift+L)
          </p>
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="4" />
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
