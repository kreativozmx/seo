"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Range calendar for a task's timeline. Rendered in a portal with fixed
// positioning so the table's overflow clipping can't cut it off. Click a day
// to start the range, click a second day to finish it; each click saves.
const POPOVER_W = 288;
const POPOVER_H = 372;

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayKey = () => {
  const n = new Date();
  return toKey(n.getFullYear(), n.getMonth(), n.getDate());
};
const addDays = (key: string, days: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function DateRangePopover({
  anchor,
  start,
  end,
  onChange,
  onClose,
}: {
  anchor: HTMLElement | null;
  start: string | null;
  end: string | null;
  onChange: (range: { startDate: string | null; endDate: string | null }) => void;
  onClose: () => void;
}) {
  const { t, dateLocale } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const initial = start ?? todayKey();
  const [view, setView] = useState({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) - 1 });
  // First click of a range is "pending" until the second click closes it.
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const weekStart = dateLocale.startsWith("en") ? 0 : 1; // Sunday for en-US, Monday otherwise

  function reposition() {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    let top = r.bottom + 6;
    if (top + POPOVER_H > window.innerHeight - 8) top = Math.max(8, r.top - POPOVER_H - 6);
    const left = Math.min(Math.max(8, r.right - POPOVER_W), window.innerWidth - POPOVER_W - 8);
    setPos({ top, left });
  }

  useLayoutEffect(reposition, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [anchor, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthLabel = new Date(Date.UTC(view.y, view.m, 1)).toLocaleDateString(dateLocale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const weekdays = useMemo(() => {
    // 2024-01-07 is a Sunday.
    return Array.from({ length: 7 }, (_, i) =>
      new Date(Date.UTC(2024, 0, 7 + ((i + weekStart) % 7))).toLocaleDateString(dateLocale, {
        weekday: "narrow",
        timeZone: "UTC",
      })
    );
  }, [dateLocale, weekStart]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.y, view.m, 1));
    const lead = (first.getUTCDay() - weekStart + 7) % 7;
    const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(toKey(view.y, view.m, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [view, weekStart]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(Date.UTC(v.y, v.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  function pick(key: string) {
    if (pendingFrom) {
      const [a, b] = key < pendingFrom ? [key, pendingFrom] : [pendingFrom, key];
      onChange({ startDate: a, endDate: b });
      setPendingFrom(null);
      setHover(null);
    } else {
      onChange({ startDate: key, endDate: key });
      setPendingFrom(key);
    }
  }

  // Range to paint: live preview while picking the second day, else the saved range.
  const previewA = pendingFrom ? (hover && hover < pendingFrom ? hover : pendingFrom) : start;
  const previewB = pendingFrom ? (hover && hover > pendingFrom ? hover : pendingFrom) : end ?? start;
  const today = todayKey();

  if (!pos) return null;
  return createPortal(
    <div
      ref={ref}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: POPOVER_W, zIndex: 10002 }}
      className="bg-white border border-neutral-200 rounded-xl shadow-xl p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => shiftMonth(-1)}
          aria-label="Mes anterior"
          className="w-7 h-7 rounded-md text-neutral-500 hover:bg-neutral-100 transition-colors"
        >
          ‹
        </button>
        <p className="text-sm font-semibold text-neutral-800 capitalize">{monthLabel}</p>
        <button
          onClick={() => shiftMonth(1)}
          aria-label="Mes siguiente"
          className="w-7 h-7 rounded-md text-neutral-500 hover:bg-neutral-100 transition-colors"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] text-neutral-400 mb-1">
        {weekdays.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
        {cells.map((key, i) => {
          if (!key) return <span key={i} className="h-9" />;
          const inRange = previewA && previewB && key >= previewA && key <= previewB;
          const isEdge = key === previewA || key === previewB;
          return (
            <button
              key={key}
              onClick={() => pick(key)}
              onMouseEnter={() => pendingFrom && setHover(key)}
              className={`h-9 text-xs transition-colors ${
                isEdge
                  ? "bg-[#228449] text-white font-semibold"
                  : inRange
                  ? "bg-[#E6F4EC] text-[#155D34]"
                  : "text-neutral-700 hover:bg-neutral-100"
              } ${
                key === previewA ? "rounded-l-full" : ""
              } ${key === previewB ? "rounded-r-full" : ""} ${!inRange ? "rounded-full" : ""} ${
                key === today && !isEdge ? "ring-1 ring-inset ring-[#228449]/50" : ""
              }`}
            >
              {Number(key.slice(8))}
            </button>
          );
        })}
      </div>

      <p className="text-[12px] text-neutral-400 mt-2 min-h-[16px]">
        {pendingFrom ? t("tasks.timeline.pickEnd") : ""}
      </p>

      <div className="flex items-center justify-between gap-2 mt-1 pt-2 border-t border-neutral-100">
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              onChange({ startDate: today, endDate: today });
              setPendingFrom(null);
            }}
            className="text-xs px-2.5 py-1 rounded-md border border-neutral-200 text-neutral-600 hover:border-neutral-300 transition-colors"
          >
            {t("tasks.timeline.today")}
          </button>
          <button
            onClick={() => {
              onChange({ startDate: today, endDate: addDays(today, 6) });
              setPendingFrom(null);
            }}
            className="text-xs px-2.5 py-1 rounded-md border border-neutral-200 text-neutral-600 hover:border-neutral-300 transition-colors"
          >
            {t("tasks.timeline.next7")}
          </button>
        </div>
        {(start || end) && (
          <button
            onClick={() => {
              onChange({ startDate: null, endDate: null });
              setPendingFrom(null);
            }}
            className="text-xs text-neutral-400 hover:text-red-600 transition-colors"
          >
            {t("tasks.timeline.clear")}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
