"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDTO } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Conexiones > YouTube: link the project's channel (by @handle, ID or URL)
// via the public YouTube Data API. The Videos tab reads from this connection.
export function YoutubeConnectionCard({ project }: { project: ProjectDTO }) {
  const router = useRouter();
  const { t } = useLocale();
  const [input, setInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = Boolean(project.youtubeChannelId);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/youtube/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("conn.youtube.errorConnect"));
      setInput("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("conn.youtube.errorConnect"));
    } finally {
      setConnecting(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/youtube/refresh`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("conn.youtube.errorConnect"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("conn.youtube.errorConnect"));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch(`/api/projects/${project.id}/youtube/disconnect`, { method: "POST" });
      router.refresh();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <p className="text-sm font-medium text-neutral-900">{t("conn.youtube.title")}</p>
      <p className="text-neutral-500 text-xs mt-0.5 mb-3">{t("conn.youtube.description")}</p>

      {connected ? (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {project.youtubeThumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.youtubeThumbnailUrl} alt="" className="w-10 h-10 rounded-full" />
            )}
            <div>
              <p className="text-sm font-medium text-neutral-900">{project.youtubeChannelTitle}</p>
              <p className="text-[14px] text-neutral-400">
                {(project.youtubeSubscribers ?? 0).toLocaleString("es-MX")} · {project.youtubeVideoCount ?? 0} videos
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs bg-white border border-neutral-200 hover:border-neutral-300 disabled:opacity-50 text-neutral-700 rounded-md px-3 py-1.5 transition-colors"
            >
              {refreshing ? t("conn.youtube.refreshing") : t("conn.youtube.refresh")}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-xs text-neutral-400 hover:text-red-600 transition-colors"
            >
              {t("conn.youtube.disconnect")}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label className="text-[14px] text-neutral-500">{t("conn.youtube.channelLabel")}</label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="@acehrproyectos"
              className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#228449] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={connecting || !input}
            className="bg-[#228449] hover:bg-[#1B6B3A] disabled:opacity-50 text-white font-medium rounded-md px-4 py-2 text-sm transition-colors"
          >
            {connecting ? t("conn.youtube.connecting") : t("conn.youtube.connect")}
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-[13px] text-neutral-400 mt-3">{t("conn.youtube.publicNote")}</p>
    </div>
  );
}
