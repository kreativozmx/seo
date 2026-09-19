"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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

const RECENT_KEY = "domainLookup.recent";

// Full-page "who owns this domain" tool (/dominio) for ANY domain — not tied
// to a project. Supports deep links (?d=example.com) and remembers the last
// few lookups in this browser.
export function DomainLookupTool() {
  const { t, dateLocale } = useLocale();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Lookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function lookup(domain: string) {
    const d = domain.trim();
    if (!d) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setShowRaw(false);
    try {
      const res = await fetch(`/api/whois?domain=${encodeURIComponent(d)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("whois.error"));
      setResult(data);
      window.history.replaceState(null, "", `/dominio?d=${encodeURIComponent(data.domain)}`);
      setRecent((prev) => {
        const next = [data.domain, ...prev.filter((x) => x !== data.domain)].slice(0, 8);
        try {
          localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch {
          // storage blocked — recents just won't persist
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("whois.error"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"));
    } catch {
      // ignore
    }
    const d = new URLSearchParams(window.location.search).get("d");
    if (d) {
      setInput(d);
      lookup(d);
    } else {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale, { year: "numeric", month: "long", day: "numeric" }) : "—";

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex gap-4 text-sm py-2 border-b border-neutral-100 last:border-0">
      <span className="w-36 shrink-0 text-neutral-400">{label}</span>
      <span className="text-neutral-800 min-w-0 break-words">{children}</span>
    </div>
  );
  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white border border-neutral-200 rounded-xl px-5 py-4">
      <p className="text-[13px] font-medium text-neutral-400 uppercase tracking-wide mb-1">{title}</p>
      {children}
    </div>
  );

  const r = result;
  const owner =
    r?.registrant && !r.registrant.redacted ? [r.registrant.name, r.registrant.org].filter(Boolean).join(" · ") : null;

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <div className="h-12 bg-white border-b border-neutral-200 flex items-center justify-between px-3 sm:px-4">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={30} height={30} className="shrink-0" />
          <span className="text-neutral-900 text-sm font-semibold tracking-tight truncate">Shopify Audit</span>
        </Link>
        <Link
          href="/"
          className="text-xs bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-md px-3 py-1.5 transition-colors"
        >
          ← {t("whois.back")}
        </Link>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{t("whois.pageTitle")}</h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-2xl">{t("whois.pageDescription")}</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(input);
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("whois.placeholder")}
            className="flex-1 bg-white border border-neutral-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-[#228449] transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors"
          >
            {loading ? t("whois.searching") : t("whois.search")}
          </button>
        </form>

        {recent.length > 0 && !r && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-neutral-400">{t("whois.recent")}:</span>
            {recent.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setInput(d);
                  lookup(d);
                }}
                className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 rounded-full px-2.5 py-1 text-neutral-600 transition-colors"
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>}

        {r && (
          <>
            <div className="flex items-center gap-3">
              <p className="text-lg font-semibold text-neutral-900 break-all">{r.domain}</p>
              {r.hostingHint && (
                <span className="text-xs bg-white border border-neutral-200 text-neutral-600 rounded-md px-2 py-0.5">
                  {r.hostingHint}
                </span>
              )}
            </div>

            {r.source === "none" ? (
              <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-4 py-3">{t("whois.notFound")}</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <Card title={t("whois.sectionRegistration")}>
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
                  {r.statuses.length > 0 && <Row label={t("whois.status")}>{r.statuses.join(", ")}</Row>}
                  {r.dnssec != null && <Row label="DNSSEC">{r.dnssec ? "Sí" : "No"}</Row>}
                </Card>
                <Card title={t("whois.sectionDates")}>
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
                </Card>
              </div>
            )}

            {(r.nameservers.length > 0 || r.dns.a.length > 0 || r.dns.mx.length > 0) && (
              <Card title={t("whois.sectionDns")}>
                {r.nameservers.length > 0 && <Row label={t("whois.nameservers")}>{r.nameservers.join(", ")}</Row>}
                {r.dns.a.length > 0 && <Row label={t("whois.ip")}>{r.dns.a.join(", ")}</Row>}
                {r.dns.mx.length > 0 && <Row label={t("whois.mail")}>{r.dns.mx.slice(0, 4).join(", ")}</Row>}
                {r.hostingHint && <Row label={t("whois.hosting")}>{r.hostingHint}</Row>}
              </Card>
            )}

            {r.rawWhois && (
              <div>
                <button
                  onClick={() => setShowRaw((v) => !v)}
                  className="text-sm text-[#228449] hover:underline underline-offset-2"
                >
                  {showRaw ? t("whois.hideRaw") : t("whois.viewRaw")}
                </button>
                {showRaw && (
                  <pre className="mt-2 text-xs leading-snug text-neutral-600 bg-white border border-neutral-200 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap">
                    {r.rawWhois}
                  </pre>
                )}
              </div>
            )}

            <p className="text-xs text-neutral-400">
              {t("whois.source", { source: r.source.toUpperCase() })} · {t("whois.note")}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
