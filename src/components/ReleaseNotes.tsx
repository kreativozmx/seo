"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { RELEASE_NOTES } from "@/lib/releaseNotes";

const SEEN_KEY = "releaseNotes.lastSeenId";

// Top-bar "Novedades" button: a dated, bulleted product changelog (content
// lives in src/lib/releaseNotes.ts). Shows an unread dot until opened.
export function ReleaseNotes() {
  const { t, locale, dateLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null | undefined>(undefined); // undefined = not read yet
  const wrapRef = useRef<HTMLDivElement>(null);
  const latestId = RELEASE_NOTES[0]?.id;

  useEffect(() => {
    try {
      setLastSeen(localStorage.getItem(SEEN_KEY));
    } catch {
      setLastSeen(null);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && latestId) {
      try {
        localStorage.setItem(SEEN_KEY, latestId);
      } catch {
        // storage blocked — the dot just won't clear across visits
      }
      // keep the unread markers visible for this opening, clear the dot
      setTimeout(() => setLastSeen(latestId), 0);
    }
  }

  const seenIndex = lastSeen === undefined ? 0 : lastSeen ? RELEASE_NOTES.findIndex((n) => n.id === lastSeen) : -1;
  // entries newer than the last-seen one are "new"
  const unreadIds = new Set(
    lastSeen === undefined ? [] : RELEASE_NOTES.slice(0, seenIndex === -1 ? RELEASE_NOTES.length : seenIndex).map((n) => n.id)
  );
  const [openedUnread, setOpenedUnread] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setOpenedUnread(new Set(unreadIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hasUnread = !open && unreadIds.size > 0;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="relative flex items-center gap-1.5 text-xs bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
          <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7L19 15Z" />
        </svg>
        <span className="hidden sm:inline">{t("news.button")}</span>
        {hasUnread && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#228449] ring-2 ring-white" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(440px,92vw)] bg-white border border-neutral-200 rounded-xl shadow-xl z-50 flex flex-col max-h-[75vh]">
          <div className="px-4 py-3 border-b border-neutral-100 shrink-0">
            <p className="text-sm font-semibold text-neutral-900">{t("news.title")}</p>
            <p className="text-xs text-neutral-500">{t("news.subtitle")}</p>
          </div>
          <div className="overflow-y-auto px-4 py-3 flex flex-col gap-5">
            {RELEASE_NOTES.map((note) => (
              <section key={note.id}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] text-neutral-400">
                    {new Date(`${note.date}T00:00:00`).toLocaleDateString(dateLocale, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  {openedUnread.has(note.id) && (
                    <span className="text-[11px] font-medium bg-[#E6F4EC] text-[#155D34] rounded px-1.5 py-0.5">
                      {t("news.new")}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-neutral-900 mb-1.5">{note.title[locale]}</p>
                <ul className="flex flex-col gap-1.5">
                  {note.items[locale].map((item, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-neutral-600 leading-snug">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-[#228449] shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
