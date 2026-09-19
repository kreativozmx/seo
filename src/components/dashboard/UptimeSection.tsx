"use client";

import { useEffect, useState } from "react";
import { ProjectDTO } from "@/lib/types";

interface Incident {
  id: string;
  startedAt: string;
  endedAt: string | null;
  lastError: string | null;
}

// Monitoreo tab: per-project uptime alerts. The actual checks run from a
// GitHub Actions workflow every 10 min (see src/lib/uptime.ts); this card
// just toggles it and shows current status plus recent incidents.
export function UptimeSection({ project }: { project: ProjectDTO }) {
  const [enabled, setEnabled] = useState(project.uptimeEnabled);
  const [status, setStatus] = useState<string | null>(project.uptimeStatus);
  const [lastChecked, setLastChecked] = useState<string | null>(project.uptimeLastCheckedAt);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${project.id}/uptime`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setStatus(d.uptimeStatus);
        setLastChecked(d.uptimeLastCheckedAt);
        setIncidents(d.incidents ?? []);
      })
      .catch(() => {});
  }, [project.id]);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setStatus(null);
    fetch(`/api/projects/${project.id}/uptime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    }).catch(() => setEnabled(!next));
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/uptime/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar");
      setTestResult(`Enviamos 2 correos de prueba a ${data.to} ✓`);
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "Error al enviar");
    } finally {
      setTesting(false);
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          className="mt-0.5 w-4 h-4 accent-[#228449] cursor-pointer shrink-0"
        />
        <div>
          <p className="text-sm text-neutral-800 font-medium">Alerta si {project.domain} se cae</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Revisamos tu sitio cada 10 minutos y te mandamos un correo si no responde en 2 revisiones
            seguidas, y otro cuando vuelve. Se envia al mismo correo de los reportes (Notificaciones).
          </p>
        </div>
      </label>

      {enabled && (
        <div className="mt-3 pl-7 flex flex-col gap-2">
          <p className="text-xs">
            {status === "down" ? (
              <span className="text-red-600 font-medium">Caido ahora mismo</span>
            ) : status === "up" ? (
              <span className="text-[#155D34] font-medium">En linea</span>
            ) : (
              <span className="text-neutral-400">Esperando la primera revision (max. 10 min)...</span>
            )}
            {lastChecked && <span className="text-neutral-400"> · ultima revision {fmt(lastChecked)}</span>}
          </p>
          <button
            onClick={handleTest}
            disabled={testing}
            className="self-start text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            {testing ? "Enviando..." : "Enviar correos de prueba"}
          </button>
          {testResult && (
            <p className={`text-xs ${testResult.includes("✓") ? "text-[#155D34]" : "text-red-600"}`}>{testResult}</p>
          )}
          {incidents.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[13px] text-neutral-400 uppercase tracking-wide">Caidas recientes</p>
              {incidents.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 text-xs bg-neutral-50 rounded-lg px-3 py-1.5">
                  <span className="text-neutral-600">
                    {fmt(i.startedAt)} {i.endedAt ? `→ ${fmt(i.endedAt)}` : "→ sigue caido"}
                  </span>
                  <span className="text-neutral-400 truncate">{i.lastError}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
