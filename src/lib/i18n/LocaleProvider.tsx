"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { LOCALE_COOKIE, Locale, TranslationKey, translate } from "@/lib/i18n/dictionaries";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  dateLocale: string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "es",
  setLocale: () => {},
  t: (key, vars) => translate("es", key, vars),
  dateLocale: "es-MX",
});

// The chosen UI language lives in a cookie (read server-side in the root
// layout for the initial value, so there's no flash of the wrong language).
// Deliberately per-browser, not per-project: it's the tool's language.
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    document.documentElement.lang = next;
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, dateLocale: locale === "en" ? "en-US" : "es-MX" }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
