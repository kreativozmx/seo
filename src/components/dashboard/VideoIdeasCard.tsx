"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDTO } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { TranslationKey } from "@/lib/i18n/dictionaries";
import { AddToTasksButton, PickBox, PickerToolbar, useTaskPicker } from "@/components/dashboard/AddToTasks";
import type { NewTask } from "@/lib/tasksClient";
import { VIDEO_TYPES, VideoTypeId } from "@/lib/videoTypes";

interface TitleIdea {
  title: string;
  topic?: string;
  why: string;
  done?: boolean;
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
  const picker = useTaskPicker();
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

  async function handleToggle(index: number) {
    const nextDone = !ideas[index]?.done;
    setIdeas((prev) => prev.map((idea, i) => (i === index ? { ...idea, done: nextDone } : idea)));
    try {
      const res = await fetch(`/api/projects/${project.id}/youtube/ideas/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, done: nextDone }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setIdeas((prev) => prev.map((idea, i) => (i === index ? { ...idea, done: !nextDone } : idea)));
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

  const ideaTasks: NewTask[] = ideas.map((idea, i) => ({
    key: String(i),
    title: `Grabar video: ${idea.title}`,
    note: [idea.topic, idea.why].filter(Boolean).join(" — ") || undefined,
  }));

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

        <div className="flex flex-col gap-1 w-64">
          <label htmlFor="virality-slider" className="text-[13px] text-neutral-500">
            {t("videos.viralityLabel")}:{" "}
            <strong className="text-neutral-800">
              {virality} · {t(`videos.virality.${virality}` as TranslationKey)}
            </strong>
          </label>
          <input
            id="virality-slider"
            type="range"
            min={1}
            max={5}
            step={1}
            value={virality}
            onChange={(e) => setVirality(Number(e.target.value))}
            className="w-full h-2 accent-[#228449] cursor-pointer"
          />
          <div className="flex justify-between text-[12px] text-neutral-400 px-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} className={n === virality ? "text-[#228449] font-semibold" : ""}>
                {n}
              </span>
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
              {t("videos.progress", { done: ideas.filter((i) => i.done).length, total: ideas.length })}
              {project.youtubeIdeasUpdatedAt && " · "}
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
            <PickerToolbar
              projectId={project.id}
              picker={picker}
              items={ideaTasks.filter((tk) => !ideas[Number(tk.key)]?.done)}
            />
            {ideas.map((idea, i) => (
              <label
                key={`${i}-${idea.title}`}
                className={`flex items-start gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                  idea.done
                    ? "bg-neutral-50 border-neutral-100"
                    : "bg-neutral-50 border-neutral-200 hover:border-neutral-300"
                }`}
              >
                {!idea.done && <PickBox projectId={project.id} picker={picker} task={ideaTasks[i]} />}
                <input
                  type="checkbox"
                  checked={Boolean(idea.done)}
                  onChange={() => handleToggle(i)}
                  className="mt-1 w-4 h-4 accent-[#228449] shrink-0 cursor-pointer"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      idea.done ? "text-neutral-400 line-through decoration-neutral-300" : "text-neutral-900"
                    }`}
                  >
                    {idea.title}
                  </p>
                  {idea.topic && (
                    <span className="inline-block text-[12px] bg-white border border-neutral-200 rounded-md px-2 py-0.5 text-neutral-500 mt-1">
                      {idea.topic}
                    </span>
                  )}
                  {idea.why && <p className="text-xs text-neutral-500 mt-1">{idea.why}</p>}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    copyOne(i);
                  }}
                  className="text-xs text-neutral-500 hover:text-[#228449] shrink-0 transition-colors"
                >
                  {copiedIndex === i ? t("content.copied") : t("videos.copy")}
                </button>
                {!idea.done && <AddToTasksButton projectId={project.id} task={ideaTasks[i]} />}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
