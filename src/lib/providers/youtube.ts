// YouTube Data API v3 — free, API-key only (uses the shared GOOGLE_API_KEY).
// Docs: https://developers.google.com/youtube/v3/docs

const BASE_URL = "https://www.googleapis.com/youtube/v3";

function apiKey() {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY no esta configurada");
  return key;
}

export interface YoutubeChannel {
  channelId: string;
  title: string;
  description: string | null;
  country: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  subscribers: number;
  views: number;
  videoCount: number;
  uploadsPlaylistId: string | null;
}

// Accepts a raw channel ID (UC...), an @handle, or a full channel/handle URL.
function parseChannelInput(input: string): { id?: string; handle?: string } {
  let value = input.trim();
  try {
    if (value.includes("youtube.com")) {
      const url = new URL(value.startsWith("http") ? value : `https://${value}`);
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "channel" && parts[1]) return { id: parts[1] };
      if (parts[0]?.startsWith("@")) return { handle: parts[0].slice(1) };
      if (parts[0]) return { handle: parts[0].replace(/^@/, "") };
    }
  } catch {
    // not a URL, fall through
  }
  value = value.replace(/^@/, "");
  if (/^UC[\w-]{22}$/.test(value)) return { id: value };
  return { handle: value };
}

export async function resolveChannel(input: string): Promise<YoutubeChannel> {
  const { id, handle } = parseChannelInput(input);
  const params = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    key: apiKey(),
  });
  if (id) params.set("id", id);
  else if (handle) params.set("forHandle", handle);
  else throw new Error("No se pudo interpretar el canal");

  const res = await fetch(`${BASE_URL}/channels?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube request failed (${res.status}): ${text}`);
  }
  const json = await res.json();
  const item = json?.items?.[0];
  if (!item) throw new Error("No se encontro ese canal de YouTube");

  return {
    channelId: item.id,
    title: item.snippet?.title ?? "",
    description: item.snippet?.description || null,
    country: item.snippet?.country ?? null,
    publishedAt: item.snippet?.publishedAt ?? null,
    thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? null,
    subscribers: Number(item.statistics?.subscriberCount ?? 0),
    views: Number(item.statistics?.viewCount ?? 0),
    videoCount: Number(item.statistics?.videoCount ?? 0),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

export interface YoutubeVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export async function fetchRecentVideos(
  uploadsPlaylistId: string,
  limit = 10
): Promise<YoutubeVideo[]> {
  const listParams = new URLSearchParams({
    part: "snippet",
    playlistId: uploadsPlaylistId,
    maxResults: String(limit),
    key: apiKey(),
  });
  const listRes = await fetch(`${BASE_URL}/playlistItems?${listParams.toString()}`);
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`YouTube request failed (${listRes.status}): ${text}`);
  }
  const listJson = await listRes.json();
  const items: {
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: { default?: { url?: string } };
      resourceId?: { videoId?: string };
    };
  }[] = listJson?.items ?? [];

  const videoIds = items
    .map((i) => i.snippet?.resourceId?.videoId)
    .filter((id): id is string => Boolean(id));

  const stats = new Map<string, { views: number; likes: number; comments: number }>();
  if (videoIds.length > 0) {
    const statsParams = new URLSearchParams({
      part: "statistics",
      id: videoIds.join(","),
      key: apiKey(),
    });
    const statsRes = await fetch(`${BASE_URL}/videos?${statsParams.toString()}`);
    if (statsRes.ok) {
      const statsJson = await statsRes.json();
      for (const v of statsJson?.items ?? []) {
        stats.set(v.id, {
          views: Number(v.statistics?.viewCount ?? 0),
          likes: Number(v.statistics?.likeCount ?? 0),
          comments: Number(v.statistics?.commentCount ?? 0),
        });
      }
    }
  }

  return items
    .filter((i) => i.snippet?.resourceId?.videoId)
    .map((i) => {
      const videoId = i.snippet!.resourceId!.videoId!;
      const s = stats.get(videoId);
      return {
        videoId,
        title: i.snippet?.title ?? "",
        description: i.snippet?.description ?? "",
        publishedAt: i.snippet?.publishedAt ?? "",
        thumbnailUrl: i.snippet?.thumbnails?.default?.url ?? null,
        viewCount: s?.views ?? 0,
        likeCount: s?.likes ?? 0,
        commentCount: s?.comments ?? 0,
      };
    });
}

export interface ResearchVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  thumbnailUrl: string | null;
}

// YouTube search for a keyword: what already ranks/performs for it. Costs
// 100 quota units per call (free daily quota is 10,000) — keep it manual.
export async function searchVideos(
  query: string,
  opts: { languageCode?: string; regionCode?: string; limit?: number } = {}
): Promise<ResearchVideo[]> {
  const { languageCode, regionCode, limit = 12 } = opts;
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(limit),
    key: apiKey(),
  });
  if (languageCode) params.set("relevanceLanguage", languageCode);
  if (regionCode) params.set("regionCode", regionCode.toUpperCase());

  const res = await fetch(`${BASE_URL}/search?${params.toString()}`);
  if (!res.ok) throw new Error(`YouTube request failed (${res.status}): ${await res.text()}`);
  const items: {
    id?: { videoId?: string };
    snippet?: { title?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { default?: { url?: string } } };
  }[] = (await res.json())?.items ?? [];

  const ids = items.map((i) => i.id?.videoId).filter((v): v is string => Boolean(v));
  const stats = new Map<string, { views: number; likes: number }>();
  if (ids.length > 0) {
    const sRes = await fetch(
      `${BASE_URL}/videos?${new URLSearchParams({ part: "statistics", id: ids.join(","), key: apiKey() }).toString()}`
    );
    if (sRes.ok) {
      for (const v of (await sRes.json())?.items ?? []) {
        stats.set(v.id, { views: Number(v.statistics?.viewCount ?? 0), likes: Number(v.statistics?.likeCount ?? 0) });
      }
    }
  }

  return items
    .filter((i) => i.id?.videoId)
    .map((i) => ({
      videoId: i.id!.videoId as string,
      title: i.snippet?.title ?? "",
      channelTitle: i.snippet?.channelTitle ?? "",
      publishedAt: i.snippet?.publishedAt ?? "",
      viewCount: stats.get(i.id!.videoId as string)?.views ?? 0,
      likeCount: stats.get(i.id!.videoId as string)?.likes ?? 0,
      thumbnailUrl: i.snippet?.thumbnails?.default?.url ?? null,
    }))
    .sort((a, b) => b.viewCount - a.viewCount);
}

export interface AudienceQuestion {
  question: string;
  videoId: string;
  videoTitle: string;
  likes: number;
}

// Real viewer comments that are questions ("?" / "¿") — each one is a topic
// people already want a video about. commentThreads.list costs 1 unit; videos
// with comments disabled just answer 403 and are skipped.
export async function fetchAudienceQuestions(
  videos: { videoId: string; title: string }[],
  perVideo = 40
): Promise<AudienceQuestion[]> {
  const out: AudienceQuestion[] = [];
  for (const v of videos) {
    const params = new URLSearchParams({
      part: "snippet",
      videoId: v.videoId,
      maxResults: String(perVideo),
      order: "relevance",
      textFormat: "plainText",
      key: apiKey(),
    });
    const res = await fetch(`${BASE_URL}/commentThreads?${params.toString()}`);
    if (!res.ok) continue;
    for (const item of (await res.json())?.items ?? []) {
      const c = item.snippet?.topLevelComment?.snippet;
      const text: string = (c?.textDisplay ?? "").replace(/\s+/g, " ").trim();
      // A "?" inside a URL (…?si=abc) is not a question — judge the text without links.
      const bare = text.replace(/https?:\/\/\S+/g, "").trim();
      if (bare.length >= 15 && text.length <= 220 && /[?¿]/.test(bare)) {
        out.push({ question: bare, videoId: v.videoId, videoTitle: v.title, likes: Number(c?.likeCount ?? 0) });
      }
    }
  }
  return out.sort((a, b) => b.likes - a.likes).slice(0, 25);
}
