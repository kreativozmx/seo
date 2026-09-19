"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDTO } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { LOCATION_GL } from "@/lib/locations";
import type { ResearchVideo, AudienceQuestion } from "@/lib/providers/youtube";

interface Research {
  query: string;
  videos: ResearchVideo[];
  searchedAt: string;
}
interface Questions {
  questions: AudienceQuestion[];
  updatedAt: string;
}

// Videos tab: YouTube research (what ranks/performs for a keyword, with
// YouTube's own autocomplete as query ideas) and real viewer questions from
// the channel's comments. Both are saved and fed into title generation.
export function VideoResearchCard({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const { t } = useLocale();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [research, setResearch] = useState<Research | null>(
    project.youtubeResearchJson ? JSON.parse(project.youtubeResearchJson) : null
  );
  const [questions, setQuestions] = useState<Questions | null>(
    project.youtubeQuestionsJson ? JSON.parse(project.youtubeQuestionsJson) : null
  );
  const [searching, setSearching] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // YouTube autocomplete as the user types (debounced).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) return setSuggestions([]);
    const id = setTimeout(() => {
      const gl = LOCATION_GL[project.locationCode] ?? "mx";
      fetch(`/api/suggest?q=${encodeURIComponent(q)}&source=youtube&hl=${project.languageCode}&gl=${gl}`)
        .then((r) => r.json())
        .then((d) => setSuggestions((d.suggestions ?? []).filter((s: string) => s.toLowerCase() !== q.toLowerCase()).slice(0, 6)))
        .catch(() => setSuggestions([]));
    }, 350);
    return () => clearTimeout(id);
  }, [query, project.languageCode, project.locationCode]);

  async function search(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/youtube/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setResearch(data.research);
      setSuggestions([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSearching(false);
    }
  }

  async function clearResearch() {
    await fetch(`/api/projects/${project.id}/youtube/research`, { method: "DELETE" });
    setResearch(null);
    router.refresh();
  }

  async function findQuestions() {
    setLoadingQuestions(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/youtube/questions`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setQuestions(data.data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoadingQuestions(false);
    }
  }

  const fmtViews = (n: number) => n.toLocaleString("es-MX");

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <p className="text-sm font-medium text-neutral-900">{t("vr.title")}</p>
      <p className="text-neutral-500 text-xs mt-0.5">{t("vr.description")}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="flex flex-wrap items-center gap-2 mt-3"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("vr.placeholder")}
          className="flex-1 min-w-[220px] bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 text-sm transition-colors"
        >
          {searching ? t("vr.searching") : t("vr.search")}
        </button>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                setQuery(s);
                search(s);
              }}
              className="text-[12px] bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-full px-2.5 py-1 text-neutral-600 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <p className="text-[12px] text-neutral-400 mt-2">{t("vr.quota")}</p>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {research && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] text-neutral-500">{t("vr.results", { query: research.query })}</p>
            <button onClick={clearResearch} className="text-xs text-neutral-400 hover:text-red-600 transition-colors">
              {t("vr.clear")}
            </button>
          </div>
          <div className="flex flex-col divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            {research.videos.map((v) => (
              <a
                key={v.videoId}
                href={`https://www.youtube.com/watch?v=${v.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-50 transition-colors"
              >
                {v.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.thumbnailUrl} alt="" className="w-14 h-10 rounded object-cover shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-800 truncate">{v.title}</p>
                  <p className="text-[12px] text-neutral-400 truncate">{v.channelTitle}</p>
                </div>
                <span className="text-xs text-neutral-500 shrink-0">
                  {fmtViews(v.viewCount)} {t("vr.views")}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-neutral-100 mt-4 pt-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-neutral-900">{t("vr.questionsTitle")}</p>
            <p className="text-neutral-500 text-xs mt-0.5 max-w-xl">{t("vr.questionsDescription")}</p>
          </div>
          <button
            onClick={findQuestions}
            disabled={loadingQuestions}
            className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors whitespace-nowrap"
          >
            {loadingQuestions ? t("vr.searching") : t("vr.questionsButton")}
          </button>
        </div>
        {questions &&
          (questions.questions.length === 0 ? (
            <p className="text-xs text-neutral-400 mt-3">{t("vr.questionsNone")}</p>
          ) : (
            <div className="flex flex-col gap-1.5 mt-3 max-h-64 overflow-y-auto">
              {questions.questions.map((q, i) => (
                <div key={i} className="bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2">
                  <p className="text-xs text-neutral-800">{q.question}</p>
                  <p className="text-[12px] text-neutral-400 mt-0.5 truncate">{q.videoTitle}</p>
                </div>
              ))}
            </div>
          ))}
      </div>

      {(research || (questions && questions.questions.length > 0)) && (
        <p className="text-[12px] text-[#155D34] mt-3">
          {t("vr.usedNote", { videos: research?.videos.length ?? 0, questions: questions?.questions.length ?? 0 })}
        </p>
      )}
    </div>
  );
}
