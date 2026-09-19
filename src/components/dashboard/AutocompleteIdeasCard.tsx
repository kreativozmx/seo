"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDTO } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LOCATION_GL } from "@/lib/locations";

// Keywords tab: free long-tail ideas from Google's autocomplete, in the
// project's language/country, one click to start tracking any of them.
export function AutocompleteIdeasCard({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const { t } = useLocale();
  const [seed, setSeed] = useState("");
  const [loading, setLoading] = useState<"search" | "expand" | null>(null);
  const [results, setResults] = useState<string[] | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const tracked = new Set(project.keywords.map((k) => k.text.toLowerCase()));

  async function run(expand: boolean) {
    if (!seed.trim()) return;
    setLoading(expand ? "expand" : "search");
    try {
      const gl = LOCATION_GL[project.locationCode] ?? "mx";
      const res = await fetch(
        `/api/suggest?q=${encodeURIComponent(seed.trim())}&hl=${project.languageCode}&gl=${gl}${expand ? "&expand=1" : ""}`
      );
      const data = await res.json();
      setResults(data.suggestions ?? []);
    } finally {
      setLoading(null);
    }
  }

  async function add(keyword: string) {
    setAdding(keyword);
    try {
      await fetch(`/api/projects/${project.id}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: keyword, engine: "google", device: "desktop", source: "planning" }),
      });
      router.refresh();
    } finally {
      setAdding(null);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <p className="text-sm font-medium text-neutral-900">{t("ac.title")}</p>
      <p className="text-neutral-500 text-xs mt-0.5 mb-3">{t("ac.description")}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(false);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder={t("ac.placeholder")}
          className="flex-1 min-w-[220px] bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
        />
        <button
          type="submit"
          disabled={loading !== null || !seed.trim()}
          className="bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 text-sm transition-colors"
        >
          {loading === "search" ? t("ac.searching") : t("ac.search")}
        </button>
        <button
          type="button"
          onClick={() => run(true)}
          disabled={loading !== null || !seed.trim()}
          className="bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-4 py-2 text-sm transition-colors"
        >
          {loading === "expand" ? t("ac.searching") : t("ac.expand")}
        </button>
      </form>

      {results && (
        <div className="mt-3">
          {results.length === 0 ? (
            <p className="text-xs text-neutral-400">{t("ac.empty")}</p>
          ) : (
            <div className="flex flex-col divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              {results.map((s) => {
                const isTracked = tracked.has(s.toLowerCase());
                return (
                  <div key={s} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                    <span className="text-neutral-700 truncate">{s}</span>
                    {isTracked ? (
                      <span className="text-neutral-400 shrink-0">{t("ac.added")}</span>
                    ) : (
                      <button
                        onClick={() => add(s)}
                        disabled={adding === s}
                        className="text-[#228449] hover:underline underline-offset-2 disabled:opacity-50 shrink-0"
                      >
                        {t("ac.add")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <p className="text-[12px] text-neutral-400 mt-2">{t("ac.unofficial")}</p>
    </div>
  );
}
