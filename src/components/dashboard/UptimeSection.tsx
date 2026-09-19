"use client";

import { useCallback, useEffect, useState } from "react";
import { ProjectDTO } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { TranslationKey } from "@/lib/i18n/dictionaries";

interface Incident {
  id: string;
  startedAt: string;
  endedAt: string | null;
  lastError: string | null;
}
interface Bucket {
  start: string;
  checks: number;
  failures: number;
}
interface UptimeData {
  uptimeStatus: string | null;
  uptimeLastCheckedAt: string | null;
  uptimeEmailsJson: string | null;
  uptimeUseReportEmail: boolean;
  recipients: string[];
  buckets: Bucket[];
  totalChecks: number;
  uptimePct: number | null;
  avgResponseMs: number | null;
  incidents: Incident[];
}

const RANGES = ["24h", "7d", "30d"] as const;

// Monitoreo tab: per-project uptime alerts + availability history. Checks
// run from a GitHub Actions workflow every 10 min (see src/lib/uptime.ts);
// this card toggles them, manages who gets the alert emails, and charts
// the recorded checks as a status strip (green = up, red = had failures,
// gray = no data yet — history only exists from when monitoring was enabled).
export function UptimeSection({ project }: { project: ProjectDTO }) {
  const { t, dateLocale } = useLocale();
  const [enabled, setEnabled] = useState(project.uptimeEnabled);
  const [range, setRange] = useState<(typeof RANGES)[number]>("24h");
  const [data, setData] = useState<UptimeData | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/projects/${project.id}/uptime?range=${range}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setData(d);
      })
      .catch(() => {});
  }, [project.id, range]);

  useEffect(() => {
    load();
  }, [load]);

  const extraEmails: string[] = data?.uptimeEmailsJson ? JSON.parse(data.uptimeEmailsJson) : [];
  const useReportEmail = data?.uptimeUseReportEmail ?? project.uptimeUseReportEmail;

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    fetch(`/api/projects/${project.id}/uptime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    })
      .then(load)
      .catch(() => setEnabled(!next));
  }

  async function saveRecipients(body: { emails?: string[]; useReportEmail?: boolean }) {
    setEmailError(null);
    const res = await fetch(`/api/projects/${project.id}/uptime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setEmailError(json.error === "Correo invalido" || !json.error ? t("notif.invalidEmail") : json.error);
      return false;
    }
    load();
    return true;
  }

  async function handleAddEmail() {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (extraEmails.includes(email)) {
      setEmailInput("");
      return;
    }
    if (await saveRecipients({ emails: [...extraEmails, email] })) setEmailInput("");
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/uptime/test`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Error al enviar");
      setTestResult(t("uptime.testsSent", { to: json.to }));
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setTesting(false);
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  const status = data?.uptimeStatus ?? null;

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <p className="text-sm text-neutral-800 font-medium">{t("uptime.chartTitle", { domain: project.domain })}</p>
      <p className="text-xs text-neutral-500 mt-0.5 mb-3">{t("uptime.chartDescription")}</p>

      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <p className="text-xs">
          {status === "down" ? (
            <span className="text-red-600 font-medium">{t("uptime.down")}</span>
          ) : status === "up" ? (
            <span className="text-[#155D34] font-medium">{t("uptime.up")}</span>
          ) : (
            <span className="text-neutral-400">{t("uptime.waiting")}</span>
          )}
          {data?.uptimeLastCheckedAt && (
            <span className="text-neutral-400"> · {t("uptime.lastCheck")} {fmt(data.uptimeLastCheckedAt)}</span>
          )}
        </p>
        <div className="flex bg-neutral-100 rounded-md p-0.5 text-[13px]">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                range === r ? "bg-white shadow-sm text-neutral-900 font-medium" : "text-neutral-500"
              }`}
            >
              {t(`uptime.range.${r}` as TranslationKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-stretch gap-[2px] h-9">
        {(data?.buckets ?? []).map((b) => {
          const color = b.checks === 0 ? "bg-neutral-200" : b.failures > 0 ? "bg-red-500" : "bg-emerald-500";
          const label =
            b.checks === 0
              ? t("uptime.noData")
              : b.failures > 0
              ? t("uptime.failedChecks", { failures: b.failures, checks: b.checks })
              : t("uptime.allUp", { checks: b.checks });
          return (
            <div
              key={b.start}
              title={`${fmt(b.start)} — ${label}`}
              className={`flex-1 min-w-[2px] rounded-[2px] ${color}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500 flex-wrap">
        <span>
          {t("uptime.availability")}{" "}
          <strong className="text-neutral-800">
            {data?.uptimePct != null ? `${data.uptimePct.toFixed(2)}%` : "—"}
          </strong>
        </span>
        <span>
          {t("uptime.avgResponse")}{" "}
          <strong className="text-neutral-800">
            {data?.avgResponseMs != null ? `${data.avgResponseMs} ms` : "—"}
          </strong>
        </span>
        <span className="flex items-center gap-3 text-neutral-400 ml-auto">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1" />{t("uptime.legend.up")}</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />{t("uptime.legend.down")}</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-neutral-200 mr-1" />{t("uptime.legend.none")}</span>
        </span>
      </div>

      {data && data.incidents.length > 0 && (
        <div className="flex flex-col gap-1 mt-4">
          <p className="text-[13px] text-neutral-400 uppercase tracking-wide">{t("uptime.recentIncidents")}</p>
          {data.incidents.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 text-xs bg-neutral-50 rounded-lg px-3 py-1.5">
              <span className="text-neutral-600">
                {fmt(i.startedAt)} {i.endedAt ? `→ ${fmt(i.endedAt)}` : `→ ${t("uptime.stillDown")}`}
              </span>
              <span className="text-neutral-400 truncate">{i.lastError}</span>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-neutral-100 mt-4 pt-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            className="mt-0.5 w-4 h-4 accent-[#228449] cursor-pointer shrink-0"
          />
          <div>
            <p className="text-sm text-neutral-800 font-medium">{t("uptime.title", { domain: project.domain })}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{t("uptime.description")}</p>
          </div>
        </label>

        {enabled && (
          <div className="mt-3 pl-7 flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium text-neutral-700 mb-1.5">{t("uptime.alertsTo")}</p>
              <label className="flex items-center gap-2 text-xs text-neutral-600 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={useReportEmail}
                  onChange={(e) => saveRecipients({ useReportEmail: e.target.checked })}
                  className="w-3.5 h-3.5 accent-[#228449] cursor-pointer"
                />
                {t("uptime.sameAsReports")}
              </label>
              {extraEmails.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {extraEmails.map((email) => (
                    <span
                      key={email}
                      className="flex items-center gap-1.5 bg-[#E6F4EC] text-[#155D34] text-xs font-medium rounded-full pl-3 pr-1.5 py-1"
                    >
                      {email}
                      <button
                        onClick={() => saveRecipients({ emails: extraEmails.filter((e) => e !== email) })}
                        aria-label={`${t("notif.removeEmail")} ${email}`}
                        className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#155D34]/10 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEmail();
                    }
                  }}
                  placeholder={t("uptime.addPlaceholder")}
                  className="w-56 bg-white border border-neutral-200 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-[#228449] transition-colors"
                />
                <button
                  onClick={handleAddEmail}
                  disabled={!emailInput.trim()}
                  className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
                >
                  {t("uptime.addEmail")}
                </button>
              </div>
              {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
              {data && data.recipients.length === 0 ? (
                <p className="text-xs text-amber-700 mt-1.5">{t("uptime.noRecipients")}</p>
              ) : data ? (
                <p className="text-xs text-neutral-400 mt-1.5">{t("uptime.willSendTo")} {data.recipients.join(", ")}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleTest}
                disabled={testing}
                className="self-start text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
              >
                {testing ? t("notif.sending") : t("uptime.sendTests")}
              </button>
              {testResult && (
                <p className={`text-xs ${testResult.includes("✓") ? "text-[#155D34]" : "text-red-600"}`}>{testResult}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
