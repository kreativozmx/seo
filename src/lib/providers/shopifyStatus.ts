// Shopify's own public status page (shopifystatus.com) runs on Atlassian
// Statuspage, which exposes a free, no-key-required JSON API — no need for
// Shopify Admin/Partner API access for this.
// Docs: https://developer.statuspage.io/

const BASE_URL = "https://www.shopifystatus.com/api/v2";

export interface ShopifyStatusComponent {
  name: string;
  status: string; // "operational" | "degraded_performance" | "partial_outage" | "major_outage" | "under_maintenance"
}

export interface ShopifyStatusIncident {
  id: string;
  name: string;
  status: string;
  impact: string;
  shortlink: string;
  updatedAt: string;
  latestUpdateBody: string | null;
}

export interface ShopifyStatusResult {
  indicator: string; // "none" | "minor" | "major" | "critical"
  description: string;
  components: ShopifyStatusComponent[];
  incidents: ShopifyStatusIncident[];
}

async function getJson(path: string) {
  const res = await fetch(`${BASE_URL}/${path}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Shopify status request failed (${res.status})`);
  return res.json();
}

export async function fetchShopifyStatus(): Promise<ShopifyStatusResult> {
  const [statusJson, summaryJson, incidentsJson] = await Promise.all([
    getJson("status.json"),
    getJson("summary.json"),
    getJson("incidents/unresolved.json"),
  ]);

  const components: ShopifyStatusComponent[] = (summaryJson?.components ?? [])
    .filter((c: { group?: boolean }) => !c.group)
    .map((c: { name?: string; status?: string }) => ({
      name: c.name ?? "",
      status: c.status ?? "operational",
    }));

  interface IncidentUpdate {
    body?: string;
  }
  interface Incident {
    id?: string;
    name?: string;
    status?: string;
    impact?: string;
    shortlink?: string;
    updated_at?: string;
    incident_updates?: IncidentUpdate[];
  }
  const incidents: ShopifyStatusIncident[] = ((incidentsJson?.incidents ?? []) as Incident[]).map((i) => ({
    id: i.id ?? "",
    name: i.name ?? "",
    status: i.status ?? "",
    impact: i.impact ?? "",
    shortlink: i.shortlink ?? "",
    updatedAt: i.updated_at ?? "",
    latestUpdateBody: i.incident_updates?.[0]?.body ?? null,
  }));

  return {
    indicator: statusJson?.status?.indicator ?? "none",
    description: statusJson?.status?.description ?? "All Systems Operational",
    components,
    incidents,
  };
}
