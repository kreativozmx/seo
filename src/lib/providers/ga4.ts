import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export interface Ga4Property {
  propertyId: string;
  displayName: string;
  accountName: string;
}

// Lists the GA4 properties the authenticated user can access, for the
// property picker (avoids making users hunt for the numeric property ID).
export async function listGa4Properties(
  auth: OAuth2Client
): Promise<Ga4Property[]> {
  const admin = google.analyticsadmin({ version: "v1beta", auth });
  const res = await admin.accountSummaries.list({ pageSize: 200 });

  const properties: Ga4Property[] = [];
  for (const account of res.data.accountSummaries ?? []) {
    for (const prop of account.propertySummaries ?? []) {
      const propertyId = prop.property?.replace("properties/", "") ?? "";
      if (!propertyId) continue;
      properties.push({
        propertyId,
        displayName: prop.displayName ?? propertyId,
        accountName: account.displayName ?? "",
      });
    }
  }
  return properties;
}

export interface Ga4Summary {
  sessions: number;
  users: number;
  conversions: number;
}

// Aggregate totals (no dimensions) for a GA4 property over the trailing
// window. propertyId is the numeric GA4 property id (Admin > Property
// details), entered manually since auto-discovery needs the separate
// (also gated) Admin API.
export async function fetchGa4Summary(
  auth: OAuth2Client,
  propertyId: string,
  days = 28
): Promise<Ga4Summary> {
  const analyticsData = google.analyticsdata({ version: "v1beta", auth });

  const res = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      metrics: [
        { name: "sessions" },
        { name: "activeUsers" },
        { name: "conversions" },
      ],
    },
  });

  const row = res.data.rows?.[0];
  const values = row?.metricValues ?? [];

  return {
    sessions: Number(values[0]?.value ?? 0),
    users: Number(values[1]?.value ?? 0),
    conversions: Number(values[2]?.value ?? 0),
  };
}

// Sources GA4 treats as "Referral" by default but that actually represent
// visits sent by an AI assistant/answer engine — broken out separately so
// the dashboard can show real AI-referred traffic instead of it hiding
// inside "Referral".
export const AI_REFERRAL_SOURCES = [
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "bard.google.com",
  "claude.ai",
  "copilot.microsoft.com",
  "www.bing.com/chat",
  "you.com",
  "meta.ai",
  "grok.com",
  "x.ai",
];

// Broader than AI_REFERRAL_SOURCES (exact domains): also catches UTM tags
// merchants or AI platforms might set (utm_source=chatgpt, utm_medium=ai,
// utm_campaign=perplexity_answer, etc.) by substring-matching source,
// medium and campaign name together instead of only the referrer domain.
const AI_KEYWORDS = [
  "chatgpt",
  "openai",
  "gpt",
  "perplexity",
  "claude",
  "anthropic",
  "gemini",
  "bard",
  "copilot",
  "grok",
  "meta.ai",
  "you.com",
  "bing.com/chat",
  "ai_overview",
  "ai-overview",
  "ai_search",
  "ai-search",
];

function looksAiRelated(...values: string[]) {
  const combined = values.join(" ").toLowerCase();
  return AI_KEYWORDS.some((k) => combined.includes(k));
}

export interface Ga4AiReferral {
  label: string; // source/medium, or "source · campaign" when a UTM campaign is set
  sessions: number;
}

export interface Ga4AiTraffic {
  totalSessions: number;
  bySource: Ga4AiReferral[];
  landingPages: { path: string; sessions: number }[];
}

// Real, automatic evidence of AI-driven traffic — sessions Google
// Analytics attributes to an AI assistant/answer engine (by referrer
// domain, e.g. chatgpt.com) OR to a UTM tag that mentions one (source,
// medium, or campaign). This is the one AI-visibility signal that's fully
// automatic for every engine, unlike DataForSEO's AI Overview detection
// (Google only) or manual mention logging (unreliable, removed).
export async function fetchGa4AiTraffic(
  auth: OAuth2Client,
  propertyId: string,
  days = 28
): Promise<Ga4AiTraffic> {
  const analyticsData = google.analyticsdata({ version: "v1beta", auth });
  const property = `properties/${propertyId}`;

  const res = await analyticsData.properties.runReport({
    property,
    requestBody: {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: "today" }],
      dimensions: [
        { name: "sessionSource" },
        { name: "sessionMedium" },
        { name: "sessionCampaignName" },
        { name: "landingPagePlusQueryString" },
      ],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: "250",
    },
  });

  interface Row {
    source: string;
    medium: string;
    campaign: string;
    landingPage: string;
    sessions: number;
  }
  const rows: Row[] = (res.data.rows ?? []).map((row) => ({
    source: row.dimensionValues?.[0]?.value ?? "",
    medium: row.dimensionValues?.[1]?.value ?? "",
    campaign: row.dimensionValues?.[2]?.value ?? "",
    landingPage: row.dimensionValues?.[3]?.value ?? "",
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }));

  const aiRows = rows.filter(
    (r) =>
      AI_REFERRAL_SOURCES.some((s) => r.source.toLowerCase().includes(s)) ||
      looksAiRelated(r.source, r.medium, r.campaign)
  );

  let totalSessions = 0;
  const bySourceMap = new Map<string, number>();
  const landingPageMap = new Map<string, number>();

  for (const r of aiRows) {
    totalSessions += r.sessions;
    const label =
      r.campaign && r.campaign !== "(not set)" ? `${r.source} · ${r.campaign}` : r.source;
    bySourceMap.set(label, (bySourceMap.get(label) ?? 0) + r.sessions);
    if (r.landingPage) {
      landingPageMap.set(r.landingPage, (landingPageMap.get(r.landingPage) ?? 0) + r.sessions);
    }
  }

  const bySource = Array.from(bySourceMap.entries())
    .map(([label, sessions]) => ({ label, sessions }))
    .sort((a, b) => b.sessions - a.sessions);

  const landingPages = Array.from(landingPageMap.entries())
    .map(([path, sessions]) => ({ path, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  return { totalSessions, bySource, landingPages };
}

export interface Ga4ChannelBreakdown {
  organic: number;
  paid: number;
  direct: number;
  referral: number;
  ai: number;
}

export async function fetchGa4ChannelBreakdown(
  auth: OAuth2Client,
  propertyId: string,
  days = 28
): Promise<Ga4ChannelBreakdown> {
  const analyticsData = google.analyticsdata({ version: "v1beta", auth });
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

  const channelRes = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
    },
  });

  let organic = 0;
  let paid = 0;
  let direct = 0;
  let referral = 0;

  for (const row of channelRes.data.rows ?? []) {
    const channel = (row.dimensionValues?.[0]?.value ?? "").toLowerCase();
    const sessions = Number(row.metricValues?.[0]?.value ?? 0);
    if (channel.includes("organic search")) organic += sessions;
    else if (channel.includes("paid search") || channel.includes("paid social"))
      paid += sessions;
    else if (channel.includes("direct")) direct += sessions;
    else if (channel.includes("referral")) referral += sessions;
  }

  const sourceRes = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges,
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
    },
  });

  let ai = 0;
  for (const row of sourceRes.data.rows ?? []) {
    const source = (row.dimensionValues?.[0]?.value ?? "").toLowerCase();
    if (AI_REFERRAL_SOURCES.some((s) => source.includes(s))) {
      ai += Number(row.metricValues?.[0]?.value ?? 0);
    }
  }
  // AI-referred sessions are counted separately from — and subtracted out
  // of — the Referral bucket they'd otherwise sit inside.
  referral = Math.max(0, referral - ai);

  return { organic, paid, direct, referral, ai };
}

export interface Ga4Analytics {
  revenue: number; // total ecommerce revenue, in the property's currency
  transactions: number;
  avgOrderValue: number;
  newUsers: number;
  engagementRate: number; // 0-1
  avgSessionDurationSec: number;
  topPages: { path: string; views: number }[];
  topCountries: { country: string; sessions: number }[];
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  topCampaigns: { source: string; sessions: number }[];
  topSources: { name: string; sessions: number }[];
  topMediums: { name: string; sessions: number }[];
  salesByChannel: SalesBreakdownRow[];
  salesBySource: SalesBreakdownRow[];
  salesByMedium: SalesBreakdownRow[];
  salesByLandingPage: SalesBreakdownRow[];
  salesByDevice: SalesBreakdownRow[];
  ordersByDate: { date: string; transactions: number; revenue: number }[];
  topProducts: { name: string; unitsSold: number; revenue: number }[];
  topAddToCartProducts: { name: string; unitsAddedToCart: number }[];
}

export interface SalesBreakdownRow {
  label: string;
  revenue: number;
  transactions: number;
  sessions: number;
}

// Merchant-facing analytics beyond channel/session counts — the numbers a
// Shopify merchant actually cares about: revenue, orders, what pages
// people land on, where traffic comes from (device/country/source), and a
// daily orders trend + top products. Ecommerce fields (revenue/transactions/
// ordersByDate/topProducts) only populate if the store has GA4 ecommerce
// tracking wired up (they come back as 0/empty otherwise, not an error).
export async function fetchGa4Analytics(
  auth: OAuth2Client,
  propertyId: string,
  days = 28
): Promise<Ga4Analytics> {
  const analyticsData = google.analyticsdata({ version: "v1beta", auth });
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
  const property = `properties/${propertyId}`;

  const [
    overviewRes,
    pagesRes,
    countriesRes,
    deviceRes,
    campaignsRes,
    sourcesRes,
    mediumsRes,
    channelSalesRes,
    sourceSalesRes,
    mediumSalesRes,
    landingPageSalesRes,
    deviceSalesRes,
    ordersRes,
    productsRes,
    addToCartRes,
  ] = await Promise.all([
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          metrics: [
            { name: "totalRevenue" },
            { name: "transactions" },
            { name: "newUsers" },
            { name: "engagementRate" },
            { name: "averageSessionDuration" },
          ],
        },
      }),
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "pagePath" }],
          metrics: [{ name: "screenPageViews" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: "20",
        },
      }),
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "country" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "5",
        },
      }),
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "sessions" }],
        },
      }),
      // Traffic sources/campaigns (source/medium + UTM campaign) — where
      // visits actually come from, beyond the broad channel grouping.
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "sessionSourceMedium" }, { name: "sessionCampaignName" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "10",
        },
      }),
      // Source alone (google, facebook, direct, newsletter...).
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "sessionSource" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "10",
        },
      }),
      // Medium alone (organic, cpc, referral, email, none...).
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "sessionMedium" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "10",
        },
      }),
      // Ventas por canal: GA4's own UTM-derived channel grouping (Organic
      // Search, Paid Search, Direct, Referral, Email, Social, etc.) next to
      // revenue/transactions — real ecommerce data, not just session
      // counts, so a merchant can see which channel actually drives sales.
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "totalRevenue" }, { name: "transactions" }, { name: "sessions" }],
          orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }],
          limit: "10",
        },
      }),
      // Ventas por fuente (google, facebook, newsletter, direct...).
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "sessionSource" }],
          metrics: [{ name: "totalRevenue" }, { name: "transactions" }, { name: "sessions" }],
          orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }],
          limit: "10",
        },
      }),
      // Ventas por medio (organic, cpc, referral, email, none...).
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "sessionMedium" }],
          metrics: [{ name: "totalRevenue" }, { name: "transactions" }, { name: "sessions" }],
          orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }],
          limit: "10",
        },
      }),
      // Ventas por pagina de destino — la aproximacion mas cercana a "por
      // keyword organica" que expone la API estandar de GA4: Google no
      // entrega el termino de busqueda organico real (viene marcado como
      // "(not provided)" desde 2013), asi que esto muestra que paginas
      // generaron esas ventas organicas; para ver las keywords reales que
      // llegan a esas paginas hay que cruzarlo con Search Console.
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "landingPagePlusQueryString" }],
          metrics: [{ name: "totalRevenue" }, { name: "transactions" }, { name: "sessions" }],
          orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }],
          limit: "10",
        },
      }),
      // Ventas por dispositivo.
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "totalRevenue" }, { name: "transactions" }, { name: "sessions" }],
          orderBys: [{ metric: { metricName: "totalRevenue" }, desc: true }],
        },
      }),
      // Daily order trend — how many purchases and how much revenue per day.
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "date" }],
          metrics: [{ name: "transactions" }, { name: "totalRevenue" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
        },
      }),
      // Best-selling products — the closest thing to "order detail" the
      // standard GA4 Data API exposes (it never returns individual orders
      // or order IDs; that needs a BigQuery export link).
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "itemName" }],
          metrics: [{ name: "itemsPurchased" }, { name: "itemRevenue" }],
          orderBys: [{ metric: { metricName: "itemRevenue" }, desc: true }],
          limit: "10",
        },
      }),
      // Most-added-to-cart products — shows purchase intent even for items
      // that don't convert, unlike topProducts (which only counts completed
      // purchases).
      analyticsData.properties.runReport({
        property,
        requestBody: {
          dateRanges,
          dimensions: [{ name: "itemName" }],
          metrics: [{ name: "itemsAddedToCart" }],
          orderBys: [{ metric: { metricName: "itemsAddedToCart" }, desc: true }],
          limit: "10",
        },
      }),
    ]);

  const overviewValues = overviewRes.data.rows?.[0]?.metricValues ?? [];
  const revenue = Number(overviewValues[0]?.value ?? 0);
  const transactions = Number(overviewValues[1]?.value ?? 0);
  const newUsers = Number(overviewValues[2]?.value ?? 0);
  const engagementRate = Number(overviewValues[3]?.value ?? 0);
  const avgSessionDurationSec = Number(overviewValues[4]?.value ?? 0);

  const topPages = (pagesRes.data.rows ?? []).map((row) => ({
    path: row.dimensionValues?.[0]?.value ?? "",
    views: Number(row.metricValues?.[0]?.value ?? 0),
  }));

  const topCountries = (countriesRes.data.rows ?? []).map((row) => ({
    country: row.dimensionValues?.[0]?.value ?? "",
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }));

  const deviceBreakdown = { mobile: 0, desktop: 0, tablet: 0 };
  for (const row of deviceRes.data.rows ?? []) {
    const device = (row.dimensionValues?.[0]?.value ?? "").toLowerCase();
    const sessions = Number(row.metricValues?.[0]?.value ?? 0);
    if (device === "mobile") deviceBreakdown.mobile += sessions;
    else if (device === "desktop") deviceBreakdown.desktop += sessions;
    else if (device === "tablet") deviceBreakdown.tablet += sessions;
  }

  const topCampaigns = (campaignsRes.data.rows ?? []).map((row) => {
    const sourceMedium = row.dimensionValues?.[0]?.value ?? "(not set)";
    const campaign = row.dimensionValues?.[1]?.value ?? "";
    const label = campaign && campaign !== "(not set)" ? `${sourceMedium} · ${campaign}` : sourceMedium;
    return { source: label, sessions: Number(row.metricValues?.[0]?.value ?? 0) };
  });

  const topSources = (sourcesRes.data.rows ?? []).map((row) => ({
    name: row.dimensionValues?.[0]?.value ?? "(not set)",
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }));

  const topMediums = (mediumsRes.data.rows ?? []).map((row) => ({
    name: row.dimensionValues?.[0]?.value ?? "(not set)",
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
  }));

  function toSalesBreakdown(
    rows: { dimensionValues?: { value?: string | null }[] | null; metricValues?: { value?: string | null }[] | null }[] | null | undefined,
    fallbackLabel = "(not set)"
  ): SalesBreakdownRow[] {
    return (rows ?? []).map((row) => ({
      label: row.dimensionValues?.[0]?.value || fallbackLabel,
      revenue: Number(row.metricValues?.[0]?.value ?? 0),
      transactions: Number(row.metricValues?.[1]?.value ?? 0),
      sessions: Number(row.metricValues?.[2]?.value ?? 0),
    }));
  }

  const salesByChannel = toSalesBreakdown(channelSalesRes.data.rows);
  const salesBySource = toSalesBreakdown(sourceSalesRes.data.rows);
  const salesByMedium = toSalesBreakdown(mediumSalesRes.data.rows);
  const salesByLandingPage = toSalesBreakdown(landingPageSalesRes.data.rows);
  const salesByDevice = toSalesBreakdown(deviceSalesRes.data.rows).map((r) => ({
    ...r,
    label: r.label.charAt(0).toUpperCase() + r.label.slice(1),
  }));

  const ordersByDate = (ordersRes.data.rows ?? []).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? ""; // YYYYMMDD
    const date =
      raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
    return {
      date,
      transactions: Number(row.metricValues?.[0]?.value ?? 0),
      revenue: Number(row.metricValues?.[1]?.value ?? 0),
    };
  });

  const topProducts = (productsRes.data.rows ?? []).map((row) => ({
    name: row.dimensionValues?.[0]?.value ?? "",
    unitsSold: Number(row.metricValues?.[0]?.value ?? 0),
    revenue: Number(row.metricValues?.[1]?.value ?? 0),
  }));

  const topAddToCartProducts = (addToCartRes.data.rows ?? []).map((row) => ({
    name: row.dimensionValues?.[0]?.value ?? "",
    unitsAddedToCart: Number(row.metricValues?.[0]?.value ?? 0),
  }));

  return {
    revenue,
    transactions,
    avgOrderValue: transactions > 0 ? revenue / transactions : 0,
    newUsers,
    engagementRate,
    avgSessionDurationSec,
    topPages,
    topCountries,
    deviceBreakdown,
    topCampaigns,
    topSources,
    topMediums,
    salesByChannel,
    salesBySource,
    salesByMedium,
    salesByLandingPage,
    salesByDevice,
    ordersByDate,
    topProducts,
    topAddToCartProducts,
  };
}

export interface Ga4PageBehavior {
  scrollByPage: { path: string; pageviews: number; scrollCount: number; scrollRate: number }[];
  engagementByPage: { path: string; sessions: number; avgEngagementSec: number }[];
  internalReferrers: { path: string; referrerPath: string; sessions: number }[];
}

// A real (if partial) stand-in for a Clarity-style heatmap, built entirely
// from GA4's standard automatic-collection events — no tracking script to
// install on the merchant's store, no custom dimensions required. GA4
// doesn't record click coordinates, so this can't draw a literal heatmap;
// instead it answers three proxy questions per page: how far do people
// scroll (the "scroll" event fires once per session at 90% depth), how
// long do they stay (userEngagementDuration), and which of the site's own
// pages send people here (pageReferrer, filtered to the project's own
// domain so external traffic sources — already shown elsewhere — don't
// crowd this out).
export async function fetchGa4PageBehavior(
  auth: OAuth2Client,
  propertyId: string,
  ownDomain: string,
  days = 28
): Promise<Ga4PageBehavior> {
  const analyticsData = google.analyticsdata({ version: "v1beta", auth });
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];
  const property = `properties/${propertyId}`;

  const [scrollRes, engagementRes, referrerRes] = await Promise.all([
    analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges,
        dimensions: [{ name: "pagePath" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: { values: ["scroll", "page_view"] },
          },
        },
        limit: "500",
      },
    }),
    analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "userEngagementDuration" }, { name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "20",
      },
    }),
    analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges,
        dimensions: [{ name: "pagePath" }, { name: "pageReferrer" }],
        metrics: [{ name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "150",
      },
    }),
  ]);

  const scrollMap = new Map<string, { pageviews: number; scrollCount: number }>();
  for (const row of scrollRes.data.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value ?? "";
    const eventName = row.dimensionValues?.[1]?.value ?? "";
    const count = Number(row.metricValues?.[0]?.value ?? 0);
    const entry = scrollMap.get(path) ?? { pageviews: 0, scrollCount: 0 };
    if (eventName === "page_view") entry.pageviews += count;
    else if (eventName === "scroll") entry.scrollCount += count;
    scrollMap.set(path, entry);
  }
  const scrollByPage = Array.from(scrollMap.entries())
    .map(([path, v]) => ({
      path,
      pageviews: v.pageviews,
      scrollCount: v.scrollCount,
      scrollRate: v.pageviews > 0 ? Math.min(v.scrollCount / v.pageviews, 1) : 0,
    }))
    .filter((r) => r.pageviews >= 10) // drop low-traffic pages, too noisy to mean anything
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, 20);

  const engagementByPage = (engagementRes.data.rows ?? []).map((row) => {
    const totalSec = Number(row.metricValues?.[0]?.value ?? 0);
    const sessions = Number(row.metricValues?.[1]?.value ?? 0);
    return {
      path: row.dimensionValues?.[0]?.value ?? "",
      sessions,
      avgEngagementSec: sessions > 0 ? totalSec / sessions : 0,
    };
  });

  const normalizedOwnDomain = ownDomain.replace(/^www\./, "").toLowerCase();
  const internalReferrers = (referrerRes.data.rows ?? [])
    .map((row) => ({
      path: row.dimensionValues?.[0]?.value ?? "",
      referrerPath: row.dimensionValues?.[1]?.value ?? "",
      sessions: Number(row.metricValues?.[0]?.value ?? 0),
    }))
    .filter((r) => r.referrerPath && r.referrerPath.toLowerCase().includes(normalizedOwnDomain))
    .slice(0, 20);

  return { scrollByPage, engagementByPage, internalReferrers };
}
