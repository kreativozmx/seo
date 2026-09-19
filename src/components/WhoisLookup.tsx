"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

interface Lookup {
  domain: string;
  source: "rdap" | "whois" | "none";
  registrar: string | null;
  registrant: { name: string | null; org: string | null; country: string | null; redacted: boolean } | null;
  created: string | null;
  expires: string | null;
  updated: string | null;
  daysToExpire: number | null;
  statuses: string[];
  nameservers: string[];
  dnssec: boolean | null;
  dns: { a: string[]; ns: string[]; mx: string[] };
  hostingHint: string | null;
  rawWhois: string | null;
}

// Top-bar "who owns this domain" lookup for ANY domain (competitors,
// suppliers, a site you're vetting) — not tied to the current project.
export function WhoisLookup() {
  const { t, dateLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setShowRaw(false);
    try {
      const res = await fetch(`/api/whois?domain=${encodeURIComponent(input.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("whois.error"));
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("whois.error"));
    } finally {
      setLoading(false);
    }
  }

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale, { year: "numeric", month: "short", day: "numeric" }) : "—";

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex gap-3 text-xs py-1.5 border-b border-neutral-100 last:border-0">
      <span className="w-28 shrink-0 text-neutral-400">{label}</span>
      <span className="text-neutral-800 min-w-0 break-words">{children}</span>
    </div>
  );

  const r = result;
  const owner = r?.registrant && !r.registrant.redacted ? [r.registrant.name, r.registrant.org].filter(Boolean).join(" · ") : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={t("whois.button")}
        aria-label={t("whois.button")}
        className="flex items-center gap-1.5 text-xs bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-md px-2.5 py-1.5 transition-colors whitespace-nowrap"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
        </svg>
        <span className="hidden md:inline">{t("whois.button")}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(440px,92vw)] bg-white border border-neutral-200 rounded-xl shadow-xl z-50 p-4">
          <form onSubmit={search} className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("whois.placeholder")}
              className="flex-1 bg-white border border-neutral-200 rounded-md px-3 py-1.5 text-sm outline-none focus:border-[#228449] transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="text-sm bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3.5 py-1.5 transition-colors"
            >
              {loading ? t("whois.searching") : t("whois.search")}
            </button>
          </form>

          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

          {r && (
            <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-neutral-900 truncate">{r.domain}</p>
                {r.hostingHint && (
                  <span className="text-[11px] bg-neutral-100 text-neutral-600 rounded px-1.5 py-0.5">{r.hostingHint}</span>
                )}
              </div>

              {r.source === "none" && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 my-2">{t("whois.notFound")}</p>
              )}

              {r.source !== "none" && (
                <>
                  <Row label={t("whois.owner")}>
                    {owner ? (
                      <>
                        {owner}
                        {r.registrant?.country ? ` (${r.registrant.country})` : ""}
                      </>
                    ) : (
                      <span className="text-neutral-400">{t("whois.private")}</span>
                    )}
                  </Row>
                  <Row label={t("whois.registrar")}>{r.registrar ?? "—"}</Row>
                  <Row label={t("whois.created")}>{fmt(r.created)}</Row>
                  <Row label={t("whois.expires")}>
                    {fmt(r.expires)}
                    {r.daysToExpire != null && (
                      <span
                        className={`ml-1.5 ${
                          r.daysToExpire < 0 ? "text-red-600" : r.daysToExpire < 60 ? "text-amber-600" : "text-neutral-400"
                        }`}
                      >
                        ({r.daysToExpire < 0 ? t("whois.expired") : t("whois.daysLeft", { days: r.daysToExpire })})
                      </span>
                    )}
                  </Row>
                  <Row label={t("whois.updated")}>{fmt(r.updated)}</Row>
                  {r.statuses.length > 0 && <Row label={t("whois.status")}>{r.statuses.join(", ")}</Row>}
                </>
              )}

              {r.nameservers.length > 0 && <Row label={t("whois.nameservers")}>{r.nameservers.join(", ")}</Row>}
              {r.dns.a.length > 0 && <Row label={t("whois.ip")}>{r.dns.a.join(", ")}</Row>}
              {r.dns.mx.length > 0 && <Row label={t("whois.mail")}>{r.dns.mx.slice(0, 3).join(", ")}</Row>}

              {r.rawWhois && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowRaw((v) => !v)}
                    className="text-xs text-[#228449] hover:underline underline-offset-2"
                  >
                    {showRaw ? t("whois.hideRaw") : t("whois.viewRaw")}
                  </button>
                  {showRaw && (
                    <pre className="mt-1.5 text-[11px] leading-snug text-neutral-600 bg-neutral-50 border border-neutral-100 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap">
                      {r.rawWhois}
                    </pre>
                  )}
                </div>
              )}

              <p className="text-[11px] text-neutral-400 mt-3">
                {t("whois.source", { source: r.source.toUpperCase() })} · {t("whois.note")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
