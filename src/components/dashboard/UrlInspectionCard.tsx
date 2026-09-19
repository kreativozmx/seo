"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDTO } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { TranslationKey } from "@/lib/i18n/dictionaries";
import type { UrlInspection } from "@/lib/providers/gsc";

const VERDICT_STYLE: Record<string, string> = {
  PASS: "bg-[#E6F4EC] text-[#155D34]",
  PARTIAL: "bg-amber-50 text-amber-700",
  NEUTRAL: "bg-amber-50 text-amber-700",
  FAIL: "bg-red-50 text-red-700",
  ERROR: "bg-neutral-100 text-neutral-500",
  VERDICT_UNSPECIFIED: "bg-neutral-100 text-neutral-500",
};

// Auditoria: what Google itself says about each key page, via the Search
// Console URL Inspection API (free, uses the existing GSC connection).
export function UrlInspectionCard({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const { t, dateLocale } = useLocale();
  const [items, setItems] = useState<UrlInspection[]>(
    project.urlInspectionsJson ? JSON.parse(project.urlInspectionsJson) : []
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState("");

  async function run(urls?: string[]) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/url-inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(urls ? { urls } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setItems(data.inspections);
      setCustomUrl("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setRunning(false);
    }
  }

  const connected = Boolean(project.gscConnectedAt);
  const indexedCount = items.filter((i) => i.verdict === "PASS").length;
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">{t("insp.title")}</p>
          <p className="text-neutral-500 text-xs mt-0.5 max-w-2xl">{t("insp.description")}</p>
        </div>
        {connected && (
          <button
            onClick={() => run()}
            disabled={running}
            className="text-xs bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            {running ? t("insp.running") : t("insp.run")}
          </button>
        )}
      </div>

      {!connected ? (
        <p className="text-xs text-neutral-400 mt-3">{t("insp.needGsc")}</p>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customUrl.trim()) run([customUrl.trim()]);
            }}
            className="flex flex-wrap items-center gap-2 mt-3"
          >
            <input
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder={t("insp.customPlaceholder")}
              className="flex-1 min-w-[220px] bg-white border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-[#228449] transition-colors"
            />
            <button
              type="submit"
              disabled={running || !customUrl.trim()}
              className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
            >
              {t("insp.customButton")}
            </button>
          </form>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

          {items.length === 0 ? (
            <p className="text-xs text-neutral-400 mt-4">{t("insp.empty")}</p>
          ) : (
            <div className="mt-4">
              <p className="text-[13px] text-neutral-400 mb-2">
                {t("insp.summary", { ok: indexedCount, total: items.length })}
                {project.urlInspectionsUpdatedAt && ` · ${t("insp.last")} ${fmt(project.urlInspectionsUpdatedAt)}`}
              </p>
              <div className="flex flex-col divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden">
                {items.map((i) => {
                  const canonicalDiff =
                    i.googleCanonical && i.userCanonical && i.googleCanonical !== i.userCanonical
                      ? i.googleCanonical
                      : null;
                  return (
                    <div key={i.url} className="px-3 py-2.5 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-medium rounded px-1.5 py-0.5 shrink-0 ${
                            VERDICT_STYLE[i.verdict] ?? VERDICT_STYLE.VERDICT_UNSPECIFIED
                          }`}
                        >
                          {t(`insp.verdict.${i.verdict in VERDICT_STYLE ? i.verdict : "VERDICT_UNSPECIFIED"}` as TranslationKey)}
                        </span>
                        <a
                          href={i.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-neutral-700 hover:text-[#228449] hover:underline truncate min-w-0"
                        >
                          {i.url.replace(/^https?:\/\//, "")}
                        </a>
                        {i.mobileVerdict && i.mobileVerdict !== "VERDICT_UNSPECIFIED" && (
                          <span className="text-[11px] text-neutral-400 ml-auto shrink-0">
                            {i.mobileVerdict === "PASS" ? t("insp.mobileOk") : t("insp.mobileIssues")}
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-neutral-500">
                        {i.error ?? i.coverageState ?? "—"}
                        {i.lastCrawlTime && ` · ${t("insp.crawled")} ${fmt(i.lastCrawlTime)}`}
                      </p>
                      {canonicalDiff && (
                        <p className="text-[12px] text-amber-700">{t("insp.canonicalDiff", { url: canonicalDiff })}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
