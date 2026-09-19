"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDTO } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { TranslationKey } from "@/lib/i18n/dictionaries";

const WEEKLY_EMAIL_SECTIONS = ["positions", "traffic", "keywords", "pages"] as const;
type WeeklyEmailSectionKey = (typeof WEEKLY_EMAIL_SECTIONS)[number];

export function WeeklyEmailSection({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const { t, dateLocale } = useLocale();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [savedTo, setSavedTo] = useState(project.weeklyEmailTo);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Optimistic UI state: the parent checkbox and section checkboxes flip
  // instantly on click instead of waiting for the save request + a full
  // router.refresh() round-trip, which was the source of the perceived lag.
  const [enabled, setEnabled] = useState(project.weeklyEmailEnabled);
  const [selectedSections, setSelectedSections] = useState<Set<WeeklyEmailSectionKey>>(
    () =>
      new Set<WeeklyEmailSectionKey>(
        project.weeklyEmailSectionsJson
          ? (JSON.parse(project.weeklyEmailSectionsJson) as WeeklyEmailSectionKey[])
          : [...WEEKLY_EMAIL_SECTIONS]
      )
  );

  async function handleSaveEmail() {
    const trimmed = emailInput.trim();
    setSaving(true);
    setEmailError(null);
    setEmailSaved(false);
    try {
      const res = await fetch(`/api/projects/${project.id}/weekly-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error === "Correo invalido" || !data.error ? t("notif.invalidEmail") : data.error);
      setSavedTo(trimmed || null);
      setEmailInput("");
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
      router.refresh();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : t("notif.invalidEmail"));
    } finally {
      setSaving(false);
    }
  }

  function handleClearEmail() {
    setSavedTo(null);
    fetch(`/api/projects/${project.id}/weekly-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: "" }),
    })
      .then(() => router.refresh())
      .catch(() => setSavedTo(savedTo));
  }

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setTestResult(null);
    fetch(`/api/projects/${project.id}/weekly-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    })
      .then(() => router.refresh())
      .catch(() => setEnabled(!next));
  }

  function handleSectionToggle(key: WeeklyEmailSectionKey) {
    const next = new Set(selectedSections);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedSections(next);
    fetch(`/api/projects/${project.id}/weekly-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections: Array.from(next) }),
    })
      .then(() => router.refresh())
      .catch(() => setSelectedSections(selectedSections));
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/weekly-email/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("notif.testError"));
      setTestResult(t("notif.testSent"));
      router.refresh();
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : t("notif.testError"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={handleToggle}
          className="mt-0.5 w-4 h-4 accent-[#228449] cursor-pointer shrink-0"
        />
        <div>
          <p className="text-sm text-neutral-800 font-medium">{t("notif.title")}</p>
          <p className="text-xs text-neutral-500 mt-0.5">{t("notif.description")}</p>
        </div>
      </label>

      {enabled && (
        <div className="mt-3 pl-7 flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium text-neutral-700 mb-1">{t("notif.sendTo")}</p>
            {savedTo && (
              <div className="flex items-center gap-1.5 bg-[#E6F4EC] text-[#155D34] text-xs font-medium rounded-full pl-3 pr-1.5 py-1 w-fit mb-2">
                {savedTo}
                <button
                  onClick={handleClearEmail}
                  aria-label={t("notif.removeEmail")}
                  className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[#155D34]/10 transition-colors"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder={savedTo ? t("notif.changeEmailPlaceholder") : t("notif.emailPlaceholder")}
                className="flex-1 min-w-[200px] bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#228449] transition-colors"
              />
              <button
                onClick={handleSaveEmail}
                disabled={saving || !emailInput.trim()}
                className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
              >
                {saving ? t("notif.saving") : emailSaved ? t("notif.saved") : t("notif.saveEmail")}
              </button>
            </div>
            {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
            {!savedTo && (
              <p className="text-xs text-neutral-400 mt-1">{t("notif.defaultEmailHint")}</p>
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
                  className="mt-0.5 w-3.5 h-3.5 accent-[#228449] cursor-pointer shrink-0"
                />
                <span>
                  <span className="text-neutral-800 font-medium block">{t(`notif.section.${key}` as TranslationKey)}</span>
                  <span className="text-neutral-500">{t(`notif.section.${key}.hint` as TranslationKey)}</span>
                </span>
              </label>
            ))}
          </div>

          <p className="text-xs text-neutral-400">
            {project.weeklyEmailLastSentAt
              ? `${t("notif.lastSent")} ${new Date(project.weeklyEmailLastSentAt).toLocaleString(dateLocale, {
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : t("notif.neverSent")}
          </p>
          <button
            onClick={handleTest}
            disabled={testing}
            className="self-start text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            {testing ? t("notif.sending") : t("notif.sendTest")}
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
