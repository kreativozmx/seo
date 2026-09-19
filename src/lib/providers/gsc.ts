import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { normalizeDomain } from "@/lib/domain";

export async function listVerifiedSites(auth: OAuth2Client) {
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const res = await searchconsole.sites.list();
  return (res.data.siteEntry ?? []).filter(
    (s) => s.permissionLevel !== "siteUnverifiedUser"
  );
}

// Picks the verified GSC property that best matches a plain domain, trying
// the domain-property form first (sc-domain:example.com), then the common
// URL-prefix variants.
export function matchSiteUrl(
  sites: { siteUrl?: string | null }[],
  domain: string
): string | null {
  const target = normalizeDomain(domain);
  const candidates = [
    `sc-domain:${target}`,
    `https://${target}/`,
    `https://www.${target}/`,
    `http://${target}/`,
    `http://www.${target}/`,
  ];
  for (const candidate of candidates) {
    const match = sites.find((s) => s.siteUrl === candidate);
    if (match?.siteUrl) return match.siteUrl;
  }
  return null;
}

export interface GscQueryRow {
  query: string;
  position: number;
  clicks: number;
  impressions: number;
  ctr: number;
}

export async function fetchTopQueries(
  auth: OAuth2Client,
  siteUrl: string,
  days = 28,
  rowLimit = 200
): Promise<GscQueryRow[]> {
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const end = new Date();
  end.setDate(end.getDate() - 2); // GSC data has a ~2 day delay
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: ["query"],
      rowLimit,
    },
  });

  return (res.data.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    position: row.position ?? 0,
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
  }));
}

export interface GscHistoryRow {
  query: string;
  date: string; // YYYY-MM-DD
  position: number;
  clicks: number;
  impressions: number;
}

// Per-day position history for the top queries by impressions, in a single
// API call (dimensions: query + date). Used to backfill the ranking chart
// with real past dates instead of a single "now" snapshot.
export async function fetchQueryHistory(
  auth: OAuth2Client,
  siteUrl: string,
  days = 30,
  maxQueries = 30
): Promise<GscHistoryRow[]> {
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: ["query", "date"],
      rowLimit: 25000,
    },
  });

  const rows: GscHistoryRow[] = (res.data.rows ?? []).map((row) => ({
    query: row.keys?.[0] ?? "",
    date: row.keys?.[1] ?? "",
    position: row.position ?? 0,
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
  }));

  const impressionsByQuery = new Map<string, number>();
  for (const row of rows) {
    impressionsByQuery.set(
      row.query,
      (impressionsByQuery.get(row.query) ?? 0) + row.impressions
    );
  }

  const topQueries = new Set(
    Array.from(impressionsByQuery.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxQueries)
      .map(([query]) => query)
  );

  return rows.filter((row) => topQueries.has(row.query));
}

export interface PageQueryCrossRef {
  path: string;
  queries: { query: string; impressions: number; clicks: number; position: number }[];
}

// For a given set of page paths (e.g. the pages AI assistants are sending
// traffic to), find the real Google queries that already rank for each
// page. GSC never reveals what someone actually typed into ChatGPT/
// Perplexity — this is a proxy: the queries Google associates with that
// same content are a reasonable stand-in for "what people are probably
// asking" when an AI cites or links to that page.
export async function fetchQueriesForPages(
  auth: OAuth2Client,
  siteUrl: string,
  pagePaths: string[],
  days = 28,
  maxQueriesPerPage = 5
): Promise<PageQueryCrossRef[]> {
  if (pagePaths.length === 0) return [];

  const searchconsole = google.searchconsole({ version: "v1", auth });

  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: ["page", "query"],
      rowLimit: 25000,
    },
  });

  function pathOf(fullUrl: string): string {
    try {
      const u = new URL(fullUrl);
      return u.pathname.replace(/\/$/, "") || "/";
    } catch {
      return fullUrl;
    }
  }

  const wantedPaths = new Set(pagePaths.map((p) => p.replace(/\/$/, "") || "/"));

  const byPath = new Map<
    string,
    { query: string; impressions: number; clicks: number; position: number }[]
  >();

  for (const row of res.data.rows ?? []) {
    const fullUrl = row.keys?.[0] ?? "";
    const path = pathOf(fullUrl);
    if (!wantedPaths.has(path)) continue;
    const query = row.keys?.[1] ?? "";
    if (!query) continue;
    if (!byPath.has(path)) byPath.set(path, []);
    byPath.get(path)!.push({
      query,
      impressions: row.impressions ?? 0,
      clicks: row.clicks ?? 0,
      position: row.position ?? 0,
    });
  }

  const result: PageQueryCrossRef[] = [];
  for (const path of Array.from(wantedPaths)) {
    const queries = (byPath.get(path) ?? [])
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, maxQueriesPerPage);
    if (queries.length > 0) result.push({ path, queries });
  }
  return result;
}

export interface GscHistoryPoint {
  date: string; // YYYY-MM-DD
  clicks: number;
  impressions: number;
  position: number; // 0 when there's no data that day
}

// Real day-by-day site totals (no query/page dimension) straight from GSC —
// this is actual historical data Google already has, up to ~16 months back,
// so the trend chart doesn't need us to start collecting our own snapshots
// from scratch. Days with literally zero impressions are omitted by the
// API, so we fill those gaps with zeros for a continuous line.
export async function fetchSiteHistory(
  auth: OAuth2Client,
  siteUrl: string,
  days = 90
): Promise<GscHistoryPoint[]> {
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: ["date"],
      rowLimit: 25000,
    },
  });

  const byDate = new Map<string, { clicks: number; impressions: number; position: number }>();
  for (const row of res.data.rows ?? []) {
    const date = row.keys?.[0] ?? "";
    if (!date) continue;
    byDate.set(date, {
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      position: row.position ?? 0,
    });
  }

  const points: GscHistoryPoint[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = fmt(cursor);
    const row = byDate.get(key);
    points.push({
      date: key,
      clicks: row?.clicks ?? 0,
      impressions: row?.impressions ?? 0,
      position: row?.position ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

export interface GscSiteSummary {
  clicks: number;
  impressions: number;
  avgPosition: number;
}

// Aggregate totals (no dimensions) for the site over the trailing window —
// used to populate the cross-project dashboard without listing every query.
export async function fetchSiteSummary(
  auth: OAuth2Client,
  siteUrl: string,
  days = 28
): Promise<GscSiteSummary> {
  const searchconsole = google.searchconsole({ version: "v1", auth });

  const end = new Date();
  end.setDate(end.getDate() - 2);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: fmt(start),
      endDate: fmt(end),
      dimensions: [],
      rowLimit: 1,
    },
  });

  const row = res.data.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    avgPosition: row?.position ?? 0,
  };
}

// Real GSC data for an explicit date range (not "last N days from today")
// so the weekly email can fetch this-week and last-week separately and
// diff them per query/page — no DataForSEO credits involved, this is all
// data Search Console already has for free.
export async function fetchQueriesForRange(
  auth: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit = 250
): Promise<GscQueryRow[]> {
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit,
    },
  });
  return (res.data.rows ?? [])
    .map((row) => ({
      query: row.keys?.[0] ?? "",
      position: row.position ?? 0,
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
      ctr: row.ctr ?? 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

export interface GscPageRow {
  page: string;
  clicks: number;
  impressions: number;
}

export async function fetchPagesForRange(
  auth: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  rowLimit = 250
): Promise<GscPageRow[]> {
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const res = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit,
    },
  });
  return (res.data.rows ?? [])
    .map((row) => ({
      page: row.keys?.[0] ?? "",
      clicks: row.clicks ?? 0,
      impressions: row.impressions ?? 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

export interface UrlInspection {
  url: string;
  verdict: string; // PASS | PARTIAL | NEUTRAL | FAIL | VERDICT_UNSPECIFIED
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  mobileVerdict: string | null;
  richResultsVerdict: string | null;
  inspectedAt: string;
  error?: string | null;
}

// Search Console URL Inspection API — what Google itself says about a URL
// (indexed? crawled when? which canonical did it pick?). Free with the
// existing OAuth token; quota is ~2,000 inspections/day per property.
export async function inspectUrl(
  auth: OAuth2Client,
  siteUrl: string,
  url: string,
  languageCode = "es"
): Promise<UrlInspection> {
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const inspectedAt = new Date().toISOString();
  try {
    const res = await searchconsole.urlInspection.index.inspect({
      requestBody: { inspectionUrl: url, siteUrl, languageCode },
    });
    const r = res.data.inspectionResult;
    const idx = r?.indexStatusResult;
    return {
      url,
      verdict: idx?.verdict ?? "VERDICT_UNSPECIFIED",
      coverageState: idx?.coverageState ?? null,
      indexingState: idx?.indexingState ?? null,
      robotsTxtState: idx?.robotsTxtState ?? null,
      pageFetchState: idx?.pageFetchState ?? null,
      lastCrawlTime: idx?.lastCrawlTime ?? null,
      googleCanonical: idx?.googleCanonical ?? null,
      userCanonical: idx?.userCanonical ?? null,
      mobileVerdict: r?.mobileUsabilityResult?.verdict ?? null,
      richResultsVerdict: r?.richResultsResult?.verdict ?? null,
      inspectedAt,
    };
  } catch (err) {
    return {
      url,
      verdict: "ERROR",
      coverageState: null,
      indexingState: null,
      robotsTxtState: null,
      pageFetchState: null,
      lastCrawlTime: null,
      googleCanonical: null,
      userCanonical: null,
      mobileVerdict: null,
      richResultsVerdict: null,
      inspectedAt,
      error: err instanceof Error ? err.message : "Error",
    };
  }
}
