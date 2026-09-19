"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";

// Top-bar entry point: opens the full domain-lookup tool (/dominio) in a new
// tab so the current project stays open.
export function WhoisLookup() {
  const { t } = useLocale();
  return (
    <a
      href="/dominio"
      target="_blank"
      rel="noopener"
      title={t("whois.button")}
      aria-label={t("whois.button")}
      className="flex items-center gap-1.5 text-xs bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-md px-2.5 py-1.5 transition-colors whitespace-nowrap"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
      </svg>
      <span className="hidden md:inline">{t("whois.button")}</span>
    </a>
  );
}
