// DataForSEO SERP API client — Google & Bing organic position tracking,
// plus AI Overview presence detection from the Google advanced endpoint.
// Docs: https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/

import { normalizeDomain } from "@/lib/domain";

export const BASE_URL = "https://api.dataforseo.com/v3";

export function authHeader() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error(
      "DataForSEO credentials are not configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)"
    );
  }
  const token = Buffer.from(`${login}:${password}`).toString("base64");
  return `Basic ${token}`;
}

export type SerpEngine = "google" | "bing";

export interface SerpFetchParams {
  keyword: string;
  engine: SerpEngine;
  locationCode: string;
  languageCode: string;
  device: "desktop" | "mobile";
}

export interface TopOrganicResult {
  domain: string;
  url: string | null;
  position: number;
}

export interface SerpCheckResult {
  position: number | null;
  url: string | null;
  aiOverviewMentioned: boolean | null;
  aiOverviewText: string | null;
  aiCitedDomains: string[];
  topOrganicResults: TopOrganicResult[];
  rawItemCount: number;
}

interface DataForSeoSerpItem {
  type: string;
  domain?: string;
  url?: string;
  title?: string;
  text?: string;
  description?: string;
  rank_absolute?: number;
  references?: DataForSeoSerpItem[];
  items?: DataForSeoSerpItem[];
  [key: string]: unknown;
}

export interface SerpSnapshot {
  items: DataForSeoSerpItem[];
}

// One SERP result page covers every domain we care about (ours + every
// competitor) — fetch it once per keyword, then call analyzeSerpForDomain
// per domain instead of re-querying DataForSEO once per domain.
export async function fetchSerpSnapshot(params: SerpFetchParams): Promise<SerpSnapshot> {
  const { keyword, engine, locationCode, languageCode, device } = params;

  const endpoint =
    engine === "google"
      ? `${BASE_URL}/serp/google/organic/live/advanced`
      : `${BASE_URL}/serp/bing/organic/live/advanced`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      {
        keyword,
        location_code: Number(locationCode),
        language_code: languageCode,
        device,
        depth: 100,
      },
    ]),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const task = json?.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error ${task.status_code}: ${task.status_message}`
    );
  }

  const items: DataForSeoSerpItem[] = task?.result?.[0]?.items ?? [];
  return { items };
}

export function analyzeSerpForDomain(
  snapshot: SerpSnapshot,
  domain: string
): SerpCheckResult {
  const items = snapshot.items;
  const target = normalizeDomain(domain);

  const organicMatch = items.find(
    (item) =>
      item.type === "organic" &&
      typeof item.domain === "string" &&
      normalizeDomain(item.domain) === target
  );

  let aiOverviewMentioned: boolean | null = null;
  let aiOverviewText: string | null = null;
  const aiCitedDomains: string[] = [];
  const aiOverview = items.find((item) => item.type === "ai_overview");
  if (aiOverview) {
    const refs: DataForSeoSerpItem[] =
      aiOverview.references ?? aiOverview.items ?? [];
    aiOverviewMentioned = refs.some(
      (ref) =>
        typeof ref?.domain === "string" &&
        normalizeDomain(ref.domain) === target
    );
    const seenDomains = new Set<string>();
    for (const ref of refs) {
      if (typeof ref?.domain !== "string") continue;
      const d = normalizeDomain(ref.domain);
      if (!seenDomains.has(d)) {
        seenDomains.add(d);
        aiCitedDomains.push(d);
      }
    }
    const textParts = refs
      .map((ref) => ref.text ?? ref.description)
      .filter((t): t is string => typeof t === "string" && t.length > 0);
    aiOverviewText =
      (typeof aiOverview.text === "string" ? aiOverview.text : null) ??
      (textParts.length > 0 ? textParts.slice(0, 3).join(" ") : null);
    if (aiOverviewText && aiOverviewText.length > 500) {
      aiOverviewText = aiOverviewText.slice(0, 500) + "…";
    }
  }

  // Full top-10 organic snapshot — used to show "who actually outranks me"
  // for this keyword, not just the competitors the user happens to track.
  const seenTopDomains = new Set<string>();
  const topOrganicResults: TopOrganicResult[] = [];
  for (const item of items) {
    if (item.type !== "organic" || typeof item.domain !== "string") continue;
    if (!item.rank_absolute || item.rank_absolute > 10) continue;
    const d = normalizeDomain(item.domain);
    if (seenTopDomains.has(d)) continue;
    seenTopDomains.add(d);
    topOrganicResults.push({ domain: d, url: item.url ?? null, position: item.rank_absolute });
  }
  topOrganicResults.sort((a, b) => a.position - b.position);

  return {
    position: organicMatch?.rank_absolute ?? null,
    url: organicMatch?.url ?? null,
    aiOverviewMentioned,
    aiOverviewText,
    aiCitedDomains,
    topOrganicResults,
    rawItemCount: items.length,
  };
}

// Convenience wrapper for one-off single-domain checks (kept for callers
// that don't need to share a snapshot across multiple domains).
export async function checkSerpPosition(
  params: SerpFetchParams & { domain: string }
): Promise<SerpCheckResult> {
  const snapshot = await fetchSerpSnapshot(params);
  return analyzeSerpForDomain(snapshot, params.domain);
}
