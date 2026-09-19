"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDTO } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { WaybackReport } from "@/lib/providers/wayback";
import { AddToTasksButton, PickBox, PickerToolbar, useTaskPicker } from "@/components/dashboard/AddToTasks";
import type { NewTask } from "@/lib/tasksClient";

// Auditoria: site history from the Wayback Machine, plus URLs that existed
// before and now 404 (or dump visitors on the homepage) — redirect candidates.
export function WaybackCard({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const { t, dateLocale } = useLocale();
  const [report, setReport] = useState<WaybackReport | null>(
    project.waybackJson ? JSON.parse(project.waybackJson) : null
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useTaskPicker();

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/wayback`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setReport(data.report);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setRunning(false);
    }
  }

  const lostTasks: NewTask[] = (report?.lost ?? []).slice(0, 25).map((l) => ({
    key: l.path,
    title: `Redirigir la URL antigua ${l.path} a una pagina actual`,
    note: `Esta URL existia (archivada el ${l.archivedAt}) y hoy ${
      l.kind === "gone" ? "devuelve error 404" : "manda a los visitantes al inicio"
    }.\nVersion archivada: ${l.archiveUrl}\nCrea una redireccion 301 hacia la pagina equivalente.`,
  }));

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(dateLocale, { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-neutral-900">{t("wb.title")}</p>
          <p className="text-neutral-500 text-xs mt-0.5 max-w-2xl">{t("wb.description")}</p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
        >
          {running ? t("wb.running") : t("wb.run")}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      {!report ? (
        <p className="text-xs text-neutral-400 mt-3">{t("wb.empty")}</p>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-neutral-600">
            {report.firstCapture && (
              <>
                {t("wb.first")} <strong className="text-neutral-900">{fmt(report.firstCapture)}</strong> ·{" "}
              </>
            )}
            {t("wb.years", { count: report.years.length })}
            {project.waybackUpdatedAt && (
              <span className="text-neutral-400"> · {t("wb.last")} {fmt(project.waybackUpdatedAt)}</span>
            )}
          </p>
          {report.partial && <p className="text-xs text-amber-700 mt-1">{t("wb.partial")}</p>}
          <p className="text-xs text-neutral-500 mt-2">
            {report.lost.length === 0
              ? t("wb.noneLost", { count: report.candidatesChecked })
              : t("wb.checked", { count: report.candidatesChecked, lost: report.lost.length })}
          </p>

          {report.lost.length > 0 && (
            <>
              <div className="mt-2">
                <PickerToolbar projectId={project.id} picker={picker} items={lostTasks} />
              </div>
              <div className="flex flex-col divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden mt-2 max-h-72 overflow-y-auto">
                {report.lost.slice(0, 25).map((l) => (
                  <div key={l.path} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <PickBox projectId={project.id} picker={picker} task={lostTasks.find((x) => x.key === l.path) as NewTask} />
                    <span
                      className={`text-[11px] font-medium rounded px-1.5 py-0.5 shrink-0 ${
                        l.kind === "gone" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {l.kind === "gone" ? t("wb.gone") : t("wb.toHome")}
                    </span>
                    <span className="truncate text-neutral-700 min-w-0" title={l.path}>
                      {l.path}
                    </span>
                    <a
                      href={l.archiveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto shrink-0 text-[#228449] hover:underline underline-offset-2"
                    >
                      {t("wb.viewArchive")}
                    </a>
                    {!picker.mode && (
                      <AddToTasksButton projectId={project.id} task={lostTasks.find((x) => x.key === l.path) as NewTask} />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[12px] text-neutral-400 mt-2">{t("wb.tip")}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
