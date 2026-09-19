"use client";

import { useEffect, useRef, useState } from "react";

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

// Pen mode: a full-screen canvas over the page for drawing freehand
// annotations while presenting. Strokes live in viewport coordinates, so
// they stay put while the page scrolls underneath — use "Borrar" between
// slides of the walkthrough.
const PEN_COLORS = ["#dc2626", "#2563eb", "#16a34a", "#eab308"] as const;
const PEN_SIZES = [3, 7] as const;
type Tool = "laser" | "pen";
interface Stroke {
  color: string;
  size: number;
  points: { x: number; y: number }[];
}

function paintStrokes(canvas: HTMLCanvasElement, strokes: Stroke[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const st of strokes) {
    ctx.strokeStyle = st.color;
    ctx.fillStyle = st.color;
    ctx.lineWidth = st.size;
    if (st.points.length === 1) {
      ctx.beginPath();
      ctx.arc(st.points[0].x, st.points[0].y, st.size / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    st.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.stroke();
  }
}

export function PresentationModeToggle() {
  const [active, setActive] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>(DEFAULT_ZOOM);
  const [tool, setTool] = useState<Tool>("laser");
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]);
  const [penSize, setPenSize] = useState<number>(PEN_SIZES[0]);
  const [strokeCount, setStrokeCount] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);

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
    dot.style.display = tool === "laser" ? "" : "none";
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
  }, [active, tool]);

  // Keep the canvas bitmap matching the viewport and drop drawings when the
  // mode closes.
  useEffect(() => {
    if (!active) {
      strokesRef.current = [];
      drawingRef.current = null;
      setStrokeCount(0);
      setTool("laser");
      return;
    }
    function fit() {
      const c = canvasRef.current;
      if (!c) return;
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      paintStrokes(c, strokesRef.current);
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [active]);

  function redraw() {
    if (canvasRef.current) paintStrokes(canvasRef.current, strokesRef.current);
    setStrokeCount(strokesRef.current.length);
  }
  function onPenDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = { color: penColor, size: penSize, points: [{ x: e.clientX, y: e.clientY }] };
    strokesRef.current.push(drawingRef.current);
    redraw();
  }
  function onPenMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current.points.push({ x: e.clientX, y: e.clientY });
    redraw();
  }
  function onPenUp() {
    drawingRef.current = null;
  }
  function undoStroke() {
    strokesRef.current.pop();
    redraw();
  }
  function clearStrokes() {
    strokesRef.current = [];
    redraw();
  }

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
      {active && (
        <canvas
          ref={canvasRef}
          data-capture-ignore
          data-pen={tool === "pen" ? "" : undefined}
          onPointerDown={tool === "pen" ? onPenDown : undefined}
          onPointerMove={tool === "pen" ? onPenMove : undefined}
          onPointerUp={onPenUp}
          onPointerCancel={onPenUp}
          className="fixed inset-0 z-[10000]"
          style={{ pointerEvents: tool === "pen" ? "auto" : "none", cursor: tool === "pen" ? "crosshair" : "none", touchAction: "none" }}
        />
      )}
    <div className="fixed bottom-5 right-5 z-[10001] flex items-center gap-2">
      {active && (
        <div className="flex items-center bg-white border border-neutral-200 rounded-full shadow-lg p-1 gap-0.5">
          {(["laser", "pen"] as const).map((tl) => (
            <button
              key={tl}
              onClick={() => setTool(tl)}
              className={`px-3 h-8 rounded-full text-[11px] font-medium transition-colors ${
                tool === tl ? "bg-red-600 text-white" : "text-neutral-500 hover:bg-neutral-100"
              }`}
            >
              {tl === "laser" ? "Láser" : "Pluma"}
            </button>
          ))}
          {tool === "pen" && (
            <>
              <span className="w-px h-5 bg-neutral-200 mx-1" />
              {PEN_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setPenColor(c)}
                  aria-label={`Color ${c}`}
                  className={`w-5 h-5 rounded-full border-2 mx-0.5 ${penColor === c ? "border-neutral-800" : "border-white"}`}
                  style={{ background: c, boxShadow: "0 0 0 1px #d4d4d4" }}
                />
              ))}
              <span className="w-px h-5 bg-neutral-200 mx-1" />
              {PEN_SIZES.map((sz) => (
                <button
                  key={sz}
                  onClick={() => setPenSize(sz)}
                  title={sz === PEN_SIZES[0] ? "Trazo fino" : "Trazo grueso"}
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${penSize === sz ? "bg-neutral-200" : "hover:bg-neutral-100"}`}
                >
                  <span className="rounded-full bg-neutral-700" style={{ width: sz + 2, height: sz + 2 }} />
                </button>
              ))}
              <span className="w-px h-5 bg-neutral-200 mx-1" />
              <button
                onClick={undoStroke}
                disabled={strokeCount === 0}
                className="px-2 h-8 rounded-full text-[11px] font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
              >
                Deshacer
              </button>
              <button
                onClick={clearStrokes}
                disabled={strokeCount === 0}
                className="px-2 h-8 rounded-full text-[11px] font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
              >
                Borrar
              </button>
            </>
          )}
        </div>
      )}
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
            Cursor láser, pluma para dibujar y zoom de pantalla para videollamadas (Ctrl+Shift+L)
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
    </>
  );
}
