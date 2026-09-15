"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RankingChart, { ChartPeriod } from "@/components/RankingChart";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ProgressBar } from "@/components/ProgressBar";
import { useSimulatedProgress } from "@/lib/useSimulatedProgress";
import {
  AUTO_ENGINES,
  ENGINE_LABELS,
  KeywordDTO,
} from "@/lib/types";

const PERIOD_OPTIONS: { value: ChartPeriod; label: string }[] = [
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "all", label: "Todo" },
];

function latestByDomain(rankings: KeywordDTO["rankings"]) {
  const map = new Map<string, KeywordDTO["rankings"][number]>();
  for (const r of rankings) {
    const existing = map.get(r.domain);
    if (!existing || new Date(r.checkedAt) > new Date(existing.checkedAt)) {
      map.set(r.domain, r);
    }
  }
  return map;
}

function PositionBadge({
  position,
  aiMentioned,
}: {
  position: number | null;
  aiMentioned?: boolean | null;
}) {
  if (position == null) {
    return (
      <span className="text-neutral-400 text-sm">
        {aiMentioned === false ? "sin mencion" : "—"}
      </span>
    );
  }
  const color =
    position <= 3
      ? "text-emerald-600"
      : position <= 10
      ? "text-amber-600"
      : "text-neutral-600";
  return <span className={`font-semibold ${color}`}>#{position}</span>;
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChangeBadge({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) {
    return <span className="text-neutral-300 text-xs">—</span>;
  }
  // Position numbers go down when you improve, so a negative delta is a
  // gain (moved up the SERP) — show it green with an up arrow.
  const improved = delta < 0;
  return (
    <span className={`text-xs font-medium ${improved ? "text-emerald-600" : "text-red-500"}`}>
      {improved ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

// Table row used in the keyword rankings table. Selecting one drives the
// single shared chart above the table.
export function KeywordListItem({
  keyword,
  ownDomain,
  competitorDomains,
  selected,
  onSelect,
  onDeleted,
  checked,
  onToggleChecked,
}: {
  keyword: KeywordDTO;
  ownDomain: string;
  competitorDomains: string[];
  selected: boolean;
  onSelect: () => void;
  onDeleted: () => void;
  checked: boolean;
  onToggleChecked: () => void;
}) {
  const router = useRouter();
  const [showCompare, setShowCompare] = useState(false);
  const latest = latestByDomain(keyword.rankings);
  const ownLatest = latest.get(ownDomain);

  const ownHistory = keyword.rankings
    .filter((r) => r.domain === ownDomain && r.position != null)
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime());
  const previousPosition = ownHistory[1]?.position ?? null;
  const change =
    ownLatest?.position != null && previousPosition != null
      ? ownLatest.position - previousPosition
      : null;
  const bestPosition =
    ownHistory.length > 0
      ? Math.min(...ownHistory.map((r) => r.position as number))
      : null;

  async function handleDelete() {
    await fetch(`/api/keywords/${keyword.id}`, { method: "DELETE" });
    onDeleted();
    router.refresh();
  }

  // Real "who outranks me" comes from the actual SERP snapshot (top 10
  // organic results) captured on the most recent automatic check — not
  // limited to domains the user happens to be tracking as competitors.
  const snapshotEntry = [...keyword.rankings]
    .filter((r) => r.domain === ownDomain && r.topResultsJson)
    .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())[0];

  const ownPosition = ownLatest?.position ?? null;
  const competitorSet = new Set(competitorDomains);
  let better: { domain: string; position: number; url: string | null; isCompetitor: boolean }[] = [];
  let usingSnapshot = false;

  if (snapshotEntry?.topResultsJson) {
    usingSnapshot = true;
    const topResults: { domain: string; url: string | null; position: number }[] = JSON.parse(
      snapshotEntry.topResultsJson
    );
    const ownSnapshotPosition = snapshotEntry.position;
    better = topResults
      .filter(
        (r) =>
          r.domain !== ownDomain &&
          (ownSnapshotPosition == null || r.position < ownSnapshotPosition)
      )
      .map((r) => ({ ...r, isCompetitor: competitorSet.has(r.domain) }))
      .sort((a, b) => a.position - b.position);
  } else {
    better = competitorDomains
      .map((domain) => ({ domain, ranking: latest.get(domain) }))
      .filter(
        (c) =>
          c.ranking?.position != null &&
          (ownPosition == null || c.ranking.position < ownPosition)
      )
      .map((c) => ({
        domain: c.domain,
        position: c.ranking!.position as number,
        url: c.ranking!.url,
        isCompetitor: true,
      }))
      .sort((a, b) => a.position - b.position);
  }

  // Top 5 best-positioned results that outrank you, in order (#1 first).
  const betterCount = better.length;
  better = better.slice(0, 5);

  return (
    <>
      <tr
        onClick={onSelect}
        className={`cursor-pointer transition-colors border-t border-neutral-100 first:border-t-0 ${
          selected ? "bg-blue-50" : "hover:bg-neutral-50"
        }`}
      >
        <td className="pl-3 pr-2 py-2 w-8">
          <input
            type="checkbox"
            checked={checked}
            onClick={(e) => e.stopPropagation()}
            onChange={onToggleChecked}
            className="shrink-0 w-4 h-4 accent-[#1A73E8] cursor-pointer"
          />
        </td>
        <td className="px-2 py-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm text-neutral-900 truncate">{keyword.text}</p>
            <span className="text-[12px] uppercase tracking-wide bg-neutral-100 text-neutral-500 rounded px-1.5 py-0.5 shrink-0">
              {ENGINE_LABELS[keyword.engine] || keyword.engine}
            </span>
            {keyword.source === "planning" && (
              <span
                title="Agregada desde Planificacion"
                className="text-[12px] uppercase tracking-wide bg-blue-50 text-[#1A73E8] rounded px-1.5 py-0.5 shrink-0"
              >
                Planificacion
              </span>
            )}
            {keyword.source === "gsc" && (
              <span
                title="Importada desde Google Search Console"
                className="text-[12px] uppercase tracking-wide bg-blue-50 text-blue-600 rounded px-1.5 py-0.5 shrink-0"
              >
                GSC
              </span>
            )}
          </div>
        </td>
        <td className="px-2 py-2 text-right">
          <PositionBadge position={ownLatest?.position ?? null} aiMentioned={ownLatest?.aiMentioned} />
        </td>
        <td className="px-2 py-2 text-right">
          <ChangeBadge delta={change} />
        </td>
        <td className="px-2 py-2 text-right hidden sm:table-cell">
          <span className="text-xs text-neutral-500">{bestPosition != null ? `#${bestPosition}` : "—"}</span>
        </td>
        <td className="px-2 py-2 hidden md:table-cell max-w-[200px]">
          {ownLatest?.url ? (
            <a
              href={ownLatest.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-neutral-400 hover:text-[#1A73E8] hover:underline truncate block"
            >
              {ownLatest.url.replace(/^https?:\/\//, "")}
            </a>
          ) : (
            <span className="text-xs text-neutral-300">—</span>
          )}
        </td>
        <td className="px-2 py-2 text-right hidden sm:table-cell">
          <span className="text-[13px] text-neutral-400 whitespace-nowrap">
            {ownLatest
              ? new Date(ownLatest.checkedAt).toLocaleDateString("es-MX", { month: "short", day: "numeric" })
              : "—"}
          </span>
        </td>
        <td className="px-2 py-2">
          <div className="flex items-center gap-1 justify-end">
            {(AUTO_ENGINES.includes(keyword.engine) || competitorDomains.length > 0) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCompare((v) => !v);
                }}
                title="Ver mi URL posicionada y quien esta mejor posicionado que yo"
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0 ${
                  showCompare
                    ? "text-[#1A73E8] bg-blue-50"
                    : "text-neutral-400 hover:text-[#1A73E8] hover:bg-blue-50"
                }`}
              >
                <CompareIcon />
              </button>
            )}
            <ConfirmButton
              onConfirm={handleDelete}
              label={<TrashIcon />}
              className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
            />
          </div>
        </td>
      </tr>

      {showCompare && (
        <tr onClick={(e) => e.stopPropagation()} className="cursor-default">
          <td colSpan={8} className="px-3 pb-2.5 pt-1 bg-neutral-50/50">
            <div className="bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2.5 flex flex-col gap-2">
              <div>
                <p className="text-[12px] text-neutral-400 uppercase tracking-wide">Tu URL posicionada</p>
                {ownLatest?.url ? (
                  <a
                    href={ownLatest.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-neutral-600 hover:text-[#1A73E8] hover:underline truncate block"
                  >
                    {ownLatest.url}
                  </a>
                ) : (
                  <p className="text-xs text-neutral-400">
                    {ownPosition == null ? "No apareces en los resultados." : "Sin URL registrada."}
                  </p>
                )}
              </div>
              <div>
                <p className="text-[12px] text-neutral-400 uppercase tracking-wide">
                  Top 5 mejor posicionados que tu{betterCount > 0 ? ` (de ${betterCount})` : ""}
                </p>
                {!usingSnapshot && !snapshotEntry && (
                  <p className="text-[12px] text-neutral-400 mt-0.5">
                    {competitorDomains.length > 0
                      ? "Aun sin un rastreo automatico reciente — mostrando solo tus competidores rastreados. Rastrea esta keyword para ver el top 10 real de Google."
                      : "Rastrea esta keyword (motor Google/Bing) para ver quien te supera en los resultados reales."}
                  </p>
                )}
                {better.length === 0 ? (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {usingSnapshot
                      ? "Nadie te supera en el top 10 de esta keyword."
                      : "Ningun competidor rastreado te supera en esta keyword."}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1 mt-1">
                    {better.map((c) => (
                      <div key={c.domain} className="flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className="font-semibold text-neutral-700 shrink-0">#{c.position}</span>
                          <span className="text-neutral-600 shrink-0">{c.domain}</span>
                          {c.isCompetitor && (
                            <span className="text-[10px] uppercase tracking-wide bg-blue-50 text-[#1A73E8] rounded px-1 py-0.5 shrink-0">
                              Competidor
                            </span>
                          )}
                          {c.url && (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neutral-400 hover:text-[#1A73E8] hover:underline truncate"
                            >
                              {c.url}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// The single chart + actions panel for whichever keyword is selected.
export function KeywordDetailCard({
  keyword,
  ownDomain,
  competitorDomains,
}: {
  keyword: KeywordDTO;
  ownDomain: string;
  competitorDomains: string[];
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("30d");
  const { percent: progress, start: startProgress, finish: finishProgress } = useSimulatedProgress();
  const [error, setError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const domains = [ownDomain, ...competitorDomains];
  const latest = latestByDomain(keyword.rankings);
  const isAuto = AUTO_ENGINES.includes(keyword.engine);

  async function handleCheck() {
    setChecking(true);
    setError(null);
    startProgress();
    try {
      const res = await fetch(`/api/keywords/${keyword.id}/check`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al rastrear");
      finishProgress();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTimeout(() => setChecking(false), 300);
    }
  }

  async function handleDelete() {
    await fetch(`/api/keywords/${keyword.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-neutral-900">{keyword.text}</p>
            <span className="text-[13px] uppercase tracking-wide bg-neutral-100 text-neutral-500 rounded px-1.5 py-0.5">
              {ENGINE_LABELS[keyword.engine] || keyword.engine}
            </span>
            <span className="text-[13px] text-neutral-400">
              {keyword.device === "mobile" ? "móvil" : "escritorio"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAuto ? (
            <button
              onClick={handleCheck}
              disabled={checking}
              className="text-xs bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 rounded-full px-3 py-1.5 transition-colors"
            >
              {checking ? "Rastreando..." : "Rastrear ahora"}
            </button>
          ) : (
            <button
              onClick={() => setShowManual((s) => !s)}
              className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-full px-3 py-1.5 transition-colors"
            >
              Registrar manual
            </button>
          )}
          <ConfirmButton
            onConfirm={handleDelete}
            label="Eliminar"
            className="text-xs text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-1.5 transition-colors"
          />
        </div>
      </div>

      {checking && (
        <div className="mt-2">
          <ProgressBar percent={progress} />
        </div>
      )}

      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {domains.map((domain) => {
          const r = latest.get(domain);
          return (
            <div
              key={domain}
              className="bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2"
            >
              <p className="text-[13px] text-neutral-500 truncate">
                {domain === ownDomain ? "Tu sitio" : domain}
              </p>
              <PositionBadge
                position={r?.position ?? null}
                aiMentioned={r?.aiMentioned}
              />
              {r?.url && (
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={r.url}
                  className="block text-[13px] text-neutral-400 hover:text-[#1A73E8] truncate mt-0.5"
                >
                  {r.url}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-1 mt-4">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setChartPeriod(opt.value)}
            className={`text-[13px] rounded-full px-2.5 py-1 transition-colors ${
              chartPeriod === opt.value
                ? "bg-[#1A73E8] text-white font-medium"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <RankingChart rankings={keyword.rankings} domains={domains} period={chartPeriod} />

      <RankingHistoryTable rankings={keyword.rankings} domains={domains} ownDomain={ownDomain} />

      {showManual && (
        <ManualEntryForm
          keywordId={keyword.id}
          domains={domains}
          isAiEngine={!isAuto}
          onSaved={() => {
            setShowManual(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// Day-by-day table under the chart: one row per calendar date, one column
// per domain, including past dates backfilled from GSC's daily history.
function RankingHistoryTable({
  rankings,
  domains,
  ownDomain,
}: {
  rankings: KeywordDTO["rankings"];
  domains: string[];
  ownDomain: string;
}) {
  const byDate = new Map<string, Map<string, KeywordDTO["rankings"][number]>>();

  for (const r of rankings) {
    const dateKey = new Date(r.checkedAt).toISOString().slice(0, 10);
    if (!byDate.has(dateKey)) byDate.set(dateKey, new Map());
    const perDomain = byDate.get(dateKey)!;
    const existing = perDomain.get(r.domain);
    if (!existing || new Date(r.checkedAt) > new Date(existing.checkedAt)) {
      perDomain.set(r.domain, r);
    }
  }

  const dates = Array.from(byDate.keys()).sort((a, b) => (a < b ? 1 : -1));

  if (dates.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-[13px] text-neutral-400 uppercase tracking-wide mb-2">
        Historial por dia
      </p>
      <div className="max-h-72 overflow-y-auto border border-neutral-100 rounded-lg">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-neutral-50">
            <tr>
              <th className="text-left font-medium text-neutral-500 px-3 py-2">
                Fecha
              </th>
              {domains.map((domain) => (
                <th
                  key={domain}
                  className="text-left font-medium text-neutral-500 px-3 py-2 truncate max-w-[140px]"
                >
                  {domain === ownDomain ? "Tu sitio" : domain}
                </th>
              ))}
              <th className="text-left font-medium text-neutral-500 px-3 py-2">
                Fuente
              </th>
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const perDomain = byDate.get(date)!;
              const ownEntry = perDomain.get(ownDomain);
              return (
                <tr key={date} className="border-t border-neutral-100">
                  <td className="px-3 py-1.5 text-neutral-500 whitespace-nowrap">
                    {new Date(`${date}T00:00:00.000Z`).toLocaleDateString(
                      "es-MX",
                      { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }
                    )}
                  </td>
                  {domains.map((domain) => {
                    const r = perDomain.get(domain);
                    return (
                      <td key={domain} className="px-3 py-1.5">
                        <PositionBadge
                          position={r?.position ?? null}
                          aiMentioned={r?.aiMentioned}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-1.5 text-neutral-400">
                    {ownEntry?.source === "gsc"
                      ? "GSC"
                      : ownEntry?.source === "manual"
                      ? "Manual"
                      : ownEntry?.source
                      ? "Rastreo"
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ManualEntryForm({
  keywordId,
  domains,
  isAiEngine,
  onSaved,
}: {
  keywordId: string;
  domains: string[];
  isAiEngine: boolean;
  onSaved: () => void;
}) {
  const [domain, setDomain] = useState(domains[0]);
  const [position, setPosition] = useState("");
  const [aiMentioned, setAiMentioned] = useState(false);
  const [source, setSource] = useState("manual");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/rankings/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywordId,
          domain,
          position: position ? Number(position) : null,
          aiMentioned: isAiEngine ? aiMentioned : null,
          source,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-wrap items-end gap-2 bg-neutral-50 border border-neutral-200 rounded-lg p-3"
    >
      <div className="flex flex-col gap-1">
        <label className="text-[13px] text-neutral-500">Dominio</label>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="bg-white border border-neutral-200 rounded px-2 py-1 text-xs"
        >
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {isAiEngine ? (
        <label className="flex items-center gap-1.5 text-xs text-neutral-600 pb-1.5">
          <input
            type="checkbox"
            checked={aiMentioned}
            onChange={(e) => setAiMentioned(e.target.checked)}
          />
          Mencionado en la respuesta
        </label>
      ) : (
        <div className="flex flex-col gap-1">
          <label className="text-[13px] text-neutral-500">Posicion</label>
          <input
            type="number"
            min={1}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="w-20 bg-white border border-neutral-200 rounded px-2 py-1 text-xs"
          />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-[13px] text-neutral-500">Fuente</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="bg-white border border-neutral-200 rounded px-2 py-1 text-xs"
        >
          <option value="manual">Manual</option>
          <option value="semrush">SEMrush</option>
          <option value="ahrefs">Ahrefs</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="text-xs bg-[#1A73E8] hover:bg-[#1557B0] disabled:opacity-50 text-white font-medium rounded px-3 py-1.5"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
