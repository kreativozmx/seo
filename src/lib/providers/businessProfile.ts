import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// Google Business Profile Performance API. Note: new Cloud projects get a
// quota of 0 for this API until Google approves a manual API access
// request (see the "Business Profile APIs" request form) — this stays
// unused (403 quota errors) until that access is granted.

const DAILY_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
];

export interface GbpLocation {
  locationName: string; // "locations/123"
  title: string;
}

// Lists the Business Profile locations the authenticated user can access,
// for the location picker. "accounts/-" is the wildcard for "whatever
// accounts this user has access to" so we don't need a separate call to
// list accounts first.
export async function listGbpLocations(
  auth: OAuth2Client
): Promise<GbpLocation[]> {
  const bi = google.mybusinessbusinessinformation({ version: "v1", auth });
  const res = await bi.accounts.locations.list({
    parent: "accounts/-",
    readMask: "name,title",
    pageSize: 100,
  });

  return (res.data.locations ?? []).map((loc) => ({
    locationName: loc.name ?? "",
    title: loc.title ?? loc.name ?? "",
  }));
}

export interface GbpSummary {
  impressions: number;
  calls: number;
  websiteClicks: number;
  directionRequests: number;
}

function sumDatedValues(
  series: { dailyMetric?: string | null; timeSeries?: { datedValues?: { value?: string | null }[] } }[] | undefined,
  metric: string
): number {
  const entry = series?.find((s) => s.dailyMetric === metric);
  const values = entry?.timeSeries?.datedValues ?? [];
  return values.reduce((sum, v) => sum + Number(v.value ?? 0), 0);
}

export async function fetchGbpSummary(
  auth: OAuth2Client,
  locationName: string,
  days = 28
): Promise<GbpSummary> {
  const bp = google.businessprofileperformance({ version: "v1", auth });

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const res = await bp.locations.fetchMultiDailyMetricsTimeSeries({
    location: locationName,
    dailyMetrics: DAILY_METRICS,
    "dailyRange.startDate.year": start.getFullYear(),
    "dailyRange.startDate.month": start.getMonth() + 1,
    "dailyRange.startDate.day": start.getDate(),
    "dailyRange.endDate.year": end.getFullYear(),
    "dailyRange.endDate.month": end.getMonth() + 1,
    "dailyRange.endDate.day": end.getDate(),
  });

  const series = res.data.multiDailyMetricTimeSeries?.[0]?.dailyMetricTimeSeries;

  const impressions =
    sumDatedValues(series, "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH") +
    sumDatedValues(series, "BUSINESS_IMPRESSIONS_MOBILE_SEARCH") +
    sumDatedValues(series, "BUSINESS_IMPRESSIONS_DESKTOP_MAPS") +
    sumDatedValues(series, "BUSINESS_IMPRESSIONS_MOBILE_MAPS");

  return {
    impressions,
    calls: sumDatedValues(series, "CALL_CLICKS"),
    websiteClicks: sumDatedValues(series, "WEBSITE_CLICKS"),
    directionRequests: sumDatedValues(series, "BUSINESS_DIRECTION_REQUESTS"),
  };
}
