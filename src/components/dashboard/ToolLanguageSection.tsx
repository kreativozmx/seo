"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LOCALES } from "@/lib/i18n/dictionaries";

// Ajustes: language of the TOOL's own UI (menus/text) — separate from the
// project's language (searches/keywords/AI content), which lives in
// LocationSection. Saved in a cookie by LocaleProvider, so it applies
// immediately without a reload.
export function ToolLanguageSection() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-3.5">
      <div className="flex bg-neutral-100 rounded-md p-0.5 text-[13px] w-fit mb-2.5">
        {LOCALES.map((l) => (
          <button
            key={l.code}
            onClick={() => setLocale(l.code)}
            aria-pressed={locale === l.code}
            className={`px-3.5 py-1.5 rounded-md transition-colors ${
              locale === l.code ? "bg-white shadow-sm text-neutral-900 font-medium" : "text-neutral-500"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-neutral-500">{t("settings.toolLanguageHint")}</p>
      <p className="text-xs text-neutral-400 mt-1">{t("settings.toolLanguageWip")}</p>
    </div>
  );
}
