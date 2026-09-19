"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const W = 260;

// Small "?" badge that explains a metric in plain words. Opens on hover,
// keyboard focus or tap (the old version used the browser's native title
// tooltip, which is slow to appear and never shows on touch screens). The
// bubble renders in a portal so table/overflow containers can't clip it.
export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  function place() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left + r.width / 2 - W / 2), window.innerWidth - W - 8);
    const above = r.top > 150;
    setPos({ top: above ? r.top - 8 : r.bottom + 8, left, above });
  }

  useEffect(() => {
    if (!open) return;
    place();
    const close = (e: Event) => {
      if (e.type === "pointerdown" && ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("pointerdown", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={text}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-neutral-200 hover:bg-neutral-300 text-neutral-600 text-[11px] font-semibold leading-none cursor-help shrink-0 align-middle normal-case transition-colors"
      >
        ?
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              left: pos.left,
              top: pos.top,
              width: W,
              transform: pos.above ? "translateY(-100%)" : undefined,
              zIndex: 10004,
            }}
            className="pointer-events-none rounded-lg bg-neutral-900 px-3 py-2.5 text-xs font-normal normal-case leading-relaxed text-left text-white shadow-lg"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}
