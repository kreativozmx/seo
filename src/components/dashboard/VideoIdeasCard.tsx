"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDTO } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { TranslationKey } from "@/lib/i18n/dictionaries";
import { VIDEO_TYPES, VideoTypeId } from "@/lib/videoTypes";

interface TitleIdea {
  title: string;
  why: string;
}

// Estrategia > Videos: AI title ideas for new videos, tuned by video type and
// a 1-5 virality level, informed by the channel's current videos.
export function VideoIdeasCard({
  project,
  videoCount,
  onGoToSettings,
}: {
  project: ProjectDTO;
  videoCount: number;
  onGoToSettings: () => void;
}) {
  const router = useRouter();
  const { t, dateLocale } = useLocale();

  const saved: { videoType?: VideoTypeId; virality?: number } = project.youtubeIdeasOptionsJson
    ? JSON.parse(project.youtubeIdeasOptionsJson)
    : {};
  const [videoType, setVideoType] = useState<VideoTypeId>(saved.videoType ?? "educational");
  const [virality, setVirality] = useState<number>(saved.virality ?? 3);
  const [ideas, setIdeas] = useState<TitleIdea[]>(
    project.youtubeIdeasJson ? JSON.parse(project.youtubeIdeasJson) : []
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/youtube/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoType, virality }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("videos.errorGenerate"));
      setIdeas(data.ideas);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("videos.errorGenerate"));
    } finally {
      setGenerating(false);
    }
  }

  async function copyOne(index: number) {
    await navigator.clipboard.writeText(ideas[index].title);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  }

  async function copyAll() {
    await navigator.clipboard.writeText(ideas.map((i) => i.title).join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <p className="text-sm font-medium text-neutral-900">{t("videos.ideas.title")}</p>
      <p className="text-neutral-500 text-xs mt-0.5">{t("videos.ideas.description")}</p>
      <p className="text-xs text-neutral-500 mt-1.5">
        {t("videos.language")}{" "}
        <strong className="text-neutral-800">{t(`lang.${project.languageCode}` as TranslationKey)}</strong>
        {" · "}
        <button onClick={onGoToSettings} className="text-[#228449] hover:underline underline-offset-2">
          {t("content.changeLanguage")}
        </button>
        {" · "}
        {t("videos.ideasBasedOn", { count: videoCount })}
      </p>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 mt-4">
        <div className="flex flex-col gap-1">
          <label className="text-[13px] text-neutral-500">{t("videos.typeLabel")}</label>
          <select
            value={videoType}
            onChange={(e) => setVideoType(e.target.value as VideoTypeId)}
            className="bg-white border border-neutral-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[#228449] transition-colors w-56"
          >
            {VIDEO_TYPES.map((v) => (
              <option key={v.id} value={v.id}>
                {t(`videos.type.${v.id}` as TranslationKey)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[13px] text-neutral-500">
            {t("videos.viralityLabel")}:{" "}
            <strong className="text-neutral-800">{t(`videos.virality.${virality}` as TranslationKey)}</strong>
          </label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setVirality(n)}
                aria-pressed={virality === n}
                title={t(`videos.virality.${n}` as TranslationKey)}
                className={`w-8 h-8 rounded-md text-xs font-medium border transition-colors ${
                  n <= virality
                    ? "bg-[#228449] border-[#228449] text-white"
                    : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-neutral-400">{t("videos.viralityHint")}</p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-sm bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 transition-colors whitespace-nowrap"
        >
          {generating ? t("content.generating") : ideas.length > 0 ? t("videos.regenerate") : t("videos.generate")}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}

      {ideas.length === 0 ? (
        <p className="text-neutral-400 text-xs mt-4">{t("videos.emptyIdeas")}</p>
      ) : (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] text-neutral-400">
              {project.youtubeIdeasUpdatedAt &&
                `${t("content.lastTime")} ${new Date(project.youtubeIdeasUpdatedAt).toLocaleDateString(dateLocale, {
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
            </p>
            <button
              onClick={copyAll}
              className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 text-neutral-700 font-medium rounded-md px-3 py-1.5 transition-colors"
            >
              {copiedAll ? t("content.copied") : t("content.copyAll")}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {ideas.map((idea, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-3 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{idea.title}</p>
                  {idea.why && <p className="text-xs text-neutral-500 mt-0.5">{idea.why}</p>}
                </div>
                <button
                  onClick={() => copyOne(i)}
                  className="text-xs text-neutral-500 hover:text-[#228449] shrink-0 transition-colors"
                >
                  {copiedIndex === i ? t("content.copied") : t("videos.copy")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
