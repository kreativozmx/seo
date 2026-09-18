"use client";

import { RefObject, useState } from "react";
import { toPng } from "html-to-image";

// Small camera-icon button dropped into the corner of any chart card.
// Rasterizes whatever DOM node `targetRef` points at (chart + its legend/
// table, not the surrounding card chrome) to a PNG via html-to-image and
// triggers a browser download. Reused across every chart in the
// dashboard so each one gets the same one-click "save this graph" action.
export function ChartCaptureButton({
  targetRef,
  filename,
  className = "",
}: {
  targetRef: RefObject<HTMLElement>;
  filename: string;
  className?: string;
}) {
  const [capturing, setCapturing] = useState(false);

  async function handleCapture() {
    if (!targetRef.current) return;
    setCapturing(true);
    try {
      const dataUrl = await toPng(targetRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        // The button can end up nested inside the captured node (it's
        // positioned relative to the chart it captures) — exclude it and
        // anything else marked so from its own screenshot.
        filter: (node) => !(node instanceof HTMLElement && node.hasAttribute("data-capture-ignore")),
      });
      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Best-effort export — if rasterizing fails there's nothing
      // actionable to show the user, so just skip the download silently
      // rather than interrupting the dashboard with an error for a
      // non-critical, purely visual feature.
    } finally {
      setCapturing(false);
    }
  }

  return (
    <button
      onClick={handleCapture}
      disabled={capturing}
      title="Descargar esta grafica como imagen PNG"
      aria-label="Descargar esta grafica como imagen PNG"
      data-capture-ignore="true"
      className={`inline-flex items-center justify-center w-7 h-7 rounded-md border border-neutral-200 bg-white text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 disabled:opacity-50 transition-colors shrink-0 ${className}`}
    >
      {capturing ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      )}
    </button>
  );
}
