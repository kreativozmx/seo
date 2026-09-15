// DataForSEO Labs API — keyword suggestions for planning, and domain
// traffic/ranked-keyword overviews used as an organic-traffic estimate for
// competitors (and, as a sanity check, your own domain).
// Docs: https://docs.dataforseo.com/v3/dataforseo_labs/

import { BASE_URL, authHeader } from "@/lib/providers/dataforseo";

export interface KeywordSuggestion {
  keyword: string;
  searchVolume: number | null;
  competition: number | null; // 0-1
  cpc: number | null;
}

export async function fetchKeywordSuggestions(
  seedKeyword: string,
  locationCode: string,
  languageCode: string,
  limit = 30
): Promise<KeywordSuggestion[]> {
  const res = await fetch(
    `${BASE_URL}/dataforseo_labs/google/keyword_suggestions/live`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword: seedKeyword,
          location_code: Number(locationCode),
          language_code: languageCode,
          limit,
          include_seed_keyword: true,
        },
      ]),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO Labs request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const task = json?.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error ${task.status_code}: ${task.status_message}`
    );
  }

  interface DataForSeoLabsItem {
    keyword: string;
    keyword_info?: { search_volume?: number; competition?: number; cpc?: number };
  }
  const items: DataForSeoLabsItem[] = task?.result?.[0]?.items ?? [];
  return items.map((item) => ({
    keyword: item.keyword,
    searchVolume: item.keyword_info?.search_volume ?? null,
    competition: item.keyword_info?.competition ?? null,
    cpc: item.keyword_info?.cpc ?? null,
  }));
}

export interface DomainTrafficOverview {
  organicKeywords: number | null;
  organicTrafficEstimate: number | null; // estimated monthly organic visits
  paidKeywords: number | null;
  paidTrafficEstimate: number | null; // estimated monthly paid visits
  trafficValueEstimate: number | null; // what that organic traffic would cost via ads (USD/mo)
}

// Estimated (not exact) organic + paid search visibility for a domain,
// based on the keywords DataForSEO has already indexed it ranking for.
// This is the same kind of estimate SEMrush/Ahrefs show — nobody outside
// the site owner can see real traffic or sales numbers.
export async function fetchDomainTrafficOverview(
  domain: string,
  locationCode: string,
  languageCode: string
): Promise<DomainTrafficOverview> {
  const res = await fetch(
    `${BASE_URL}/dataforseo_labs/google/domain_rank_overview/live`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          target: domain,
          location_code: Number(locationCode),
          language_code: languageCode,
        },
      ]),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO Labs request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const task = json?.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error ${task.status_code}: ${task.status_message}`
    );
  }

  const metrics = task?.result?.[0]?.items?.[0]?.metrics;
  const organic = metrics?.organic;
  const paid = metrics?.paid;

  return {
    organicKeywords: organic?.count ?? null,
    organicTrafficEstimate: organic?.etv != null ? Math.round(organic.etv) : null,
    paidKeywords: paid?.count ?? null,
    paidTrafficEstimate: paid?.etv != null ? Math.round(paid.etv) : null,
    trafficValueEstimate:
      organic?.estimated_paid_traffic_cost != null
        ? Math.round(organic.estimated_paid_traffic_cost)
        : null,
  };
}

export interface CompetitorSuggestion {
  domain: string;
  commonKeywords: number; // how many keywords this domain shares with the target
  organicKeywords: number | null;
  organicTrafficEstimate: number | null;
}

// "Who else ranks for the same keywords as me" — DataForSEO Labs'
// competitors_domain endpoint, sorted by how many keywords they share with
// the target domain. Used to suggest competitors to add, instead of the
// merchant having to know/guess who they compete with.
export async function fetchCompetitorSuggestions(
  domain: string,
  locationCode: string,
  languageCode: string,
  limit = 20
): Promise<CompetitorSuggestion[]> {
  const res = await fetch(
    `${BASE_URL}/dataforseo_labs/google/competitors_domain/live`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          target: domain,
          location_code: Number(locationCode),
          language_code: languageCode,
          limit,
          exclude_top_domains: true,
          order_by: ["intersections,desc"],
        },
      ]),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO Labs request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const task = json?.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error ${task.status_code}: ${task.status_message}`
    );
  }

  interface CompetitorItem {
    domain?: string;
    intersections?: number;
    full_domain_metrics?: { organic?: { count?: number; etv?: number } };
  }
  const items: CompetitorItem[] = task?.result?.[0]?.items ?? [];
  return items
    .filter((item) => item.domain)
    .map((item) => ({
      domain: (item.domain as string).toLowerCase(),
      commonKeywords: item.intersections ?? 0,
      organicKeywords: item.full_domain_metrics?.organic?.count ?? null,
      organicTrafficEstimate:
        item.full_domain_metrics?.organic?.etv != null
          ? Math.round(item.full_domain_metrics.organic.etv)
          : null,
    }));
}

export interface RankedKeyword {
  keyword: string;
  position: number | null;
  searchVolume: number | null;
  url: string | null;
}

// Keywords a domain already ranks for organically in Google, sorted by
// position. Same estimate-based source SEMrush/Ahrefs use for "organic
// keywords" — useful to see what a competitor (or your own site) is
// actually positioned for.
export async function fetchRankedKeywords(
  domain: string,
  locationCode: string,
  languageCode: string,
  limit = 20
): Promise<RankedKeyword[]> {
  const res = await fetch(
    `${BASE_URL}/dataforseo_labs/google/ranked_keywords/live`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          target: domain,
          location_code: Number(locationCode),
          language_code: languageCode,
          limit,
          order_by: ["ranked_serp_element.serp_item.rank_group,asc"],
        },
      ]),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DataForSEO Labs request failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const task = json?.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error ${task.status_code}: ${task.status_message}`
    );
  }

  interface RankedKeywordItem {
    keyword_data?: { keyword?: string; keyword_info?: { search_volume?: number } };
    ranked_serp_element?: {
      serp_item?: { rank_group?: number; rank_absolute?: number; url?: string };
    };
  }
  const items: RankedKeywordItem[] = task?.result?.[0]?.items ?? [];
  return items
    .map((item) => ({
      keyword: item.keyword_data?.keyword ?? "",
      position:
        item.ranked_serp_element?.serp_item?.rank_group ??
        item.ranked_serp_element?.serp_item?.rank_absolute ??
        null,
      searchVolume: item.keyword_data?.keyword_info?.search_volume ?? null,
      url: item.ranked_serp_element?.serp_item?.url ?? null,
    }))
    .filter((k) => k.keyword);
}
