"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDTO } from "@/lib/types";

const WEEKLY_EMAIL_SECTIONS = ["positions", "traffic", "keywords", "pages"] as const;
type WeeklyEmailSectionKey = (typeof WEEKLY_EMAIL_SECTIONS)[number];
const WEEKLY_EMAIL_SECTION_LABELS: Record<WeeklyEmailSectionKey, { label: string; hint: string }> = {
  positions: {
    label: "Resumen de posiciones",
    hint: "Posicion promedio, Top 3, Top 10 y las keywords que mas se movieron — de tu propio rastreo.",
  },
  traffic: {
    label: "Trafico (Search Console)",
    hint: "Clics e impresiones de esta semana vs. la anterior, datos reales de GSC.",
  },
  keywords: {
    label: "Keywords principales",
    hint: "Tus keywords con mas clics en GSC esta semana, con su posicion y cambio.",
  },
  pages: {
    label: "Paginas de destino principales",
    hint: "Tus paginas con mas clics en GSC esta semana, con su cambio.",
  },
};

export function WeeklyEmailSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState(project.weeklyEmailTo ?? "");
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const selectedSections = new Set<WeeklyEmailSectionKey>(
    project.weeklyEmailSectionsJson
      ? (JSON.parse(project.weeklyEmailSectionsJson) as WeeklyEmailSectionKey[])
      : [...WEEKLY_EMAIL_SECTIONS]
  );

  async function handleSaveEmail() {
    setSaving(true);
    setEmailError(null);
    setEmailSaved(false);
    try {
      const res = await fetch(`/api/projects/${project.id}/weekly-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Correo invalido");
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
      router.refresh();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Correo invalido");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    setSaving(true);
    setTestResult(null);
    try {
      await fetch(`/api/projects/${project.id}/weekly-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !project.weeklyEmailEnabled }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleSectionToggle(key: WeeklyEmailSectionKey) {
    const next = new Set(selectedSections);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSaving(true);
    try {
      await fetch(`/api/projects/${project.id}/weekly-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: Array.from(next) }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/weekly-email/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar el correo de prueba");
      setTestResult("Correo de prueba enviado ✓");
      router.refresh();
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "Error al enviar el correo de prueba");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={project.weeklyEmailEnabled}
          onChange={handleToggle}
          disabled={saving}
          className="mt-0.5 w-4 h-4 accent-[#228449] cursor-pointer shrink-0"
        />
        <div>
          <p className="text-sm text-neutral-800 font-medium">Resumen semanal por correo</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Cada lunes recibes un correo con datos reales de tu propio rastreo y de Search
            Console — no usa creditos de DataForSEO. Elige abajo que secciones incluir.
          </p>
        </div>
      </label>

      {project.weeklyEmailEnabled && (
        <div className="mt-3 pl-7 flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium text-neutral-700 mb-1">Enviar a</p>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="tu@correo.com"
                className="flex-1 min-w-[200px] bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#228449] transition-colors"
              />
              <button
                onClick={handleSaveEmail}
                disabled={saving}
                className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
              >
                {saving ? "Guardando..." : emailSaved ? "Guardado ✓" : "Guardar correo"}
              </button>
            </div>
            {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
            {!project.weeklyEmailTo && (
              <p className="text-xs text-neutral-400 mt-1">
                Sin un correo aqui, se usa el correo con el que inicias sesion.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {WEEKLY_EMAIL_SECTIONS.map((key) => (
              <label
                key={key}
                className="flex items-start gap-2 text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 cursor-pointer hover:border-neutral-300 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedSections.has(key)}
                  onChange={() => handleSectionToggle(key)}
                  disabled={saving}
                  className="mt-0.5 w-3.5 h-3.5 accent-[#228449] cursor-pointer shrink-0"
                />
                <span>
                  <span className="text-neutral-800 font-medium block">{WEEKLY_EMAIL_SECTION_LABELS[key].label}</span>
                  <span className="text-neutral-500">{WEEKLY_EMAIL_SECTION_LABELS[key].hint}</span>
                </span>
              </label>
            ))}
          </div>

          <p className="text-xs text-neutral-400">
            {project.weeklyEmailLastSentAt
              ? `Ultimo enviado: ${new Date(project.weeklyEmailLastSentAt).toLocaleString("es-MX", {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : "Aun no se ha enviado ninguno — el primero sale el proximo lunes."}
          </p>
          <button
            onClick={handleTest}
            disabled={testing}
            className="self-start text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            {testing ? "Enviando..." : "Enviar de prueba ahora"}
          </button>
          {testResult && (
            <p className={`text-xs ${testResult.includes("✓") ? "text-[#155D34]" : "text-red-600"}`}>
              {testResult}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
