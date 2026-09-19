// OpenPageRank (now run with Keywords Everywhere): a free 0-10 domain
// authority score built from Common Crawl link data — a cheap stand-in for
// paid "domain rating" numbers. Needs an OPR API key (OPEN_PAGERANK_API_KEY):
// sign in at openpagerank.com with a (free) Keywords Everywhere API key, then
// create the OPR key in its Dashboard. Docs: openpagerank.keywordseverywhere.com/docs
export interface DomainAuthority {
  score: number | null; // 0-10, up to 2 decimals
  globalRank: number | null; // 1 = highest
}

const BASE_URL = "https://openpagerank.keywordseverywhere.com";

export async function fetchDomainAuthority(domains: string[]): Promise<Record<string, DomainAuthority>> {
  const key = process.env.OPEN_PAGERANK_API_KEY;
  if (!key) {
    throw new Error(
      "Falta OPEN_PAGERANK_API_KEY: entra a openpagerank.com con tu llave gratuita de Keywords Everywhere, crea una llave OPR en el Dashboard y agregala a las variables de entorno."
    );
  }

  const res = await fetch(`${BASE_URL}/v1/domains/bulk`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    // Current score only — the monthly history isn't needed here.
    body: JSON.stringify({ domains: Array.from(new Set(domains)).slice(0, 100), include_history: false }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { type?: string; message?: string } } | null;
    if (res.status === 401) throw new Error("La llave de Open PageRank (OPEN_PAGERANK_API_KEY) es invalida o esta mal copiada.");
    if (res.status === 429) {
      throw new Error(
        body?.error?.type === "quota_error"
          ? "Se agoto el limite mensual de dominios de tu plan de Open PageRank."
          : "Demasiadas consultas a Open PageRank; intenta de nuevo en un minuto."
      );
    }
    throw new Error(`Open PageRank respondio ${res.status}${body?.error?.message ? `: ${body.error.message}` : ""}`);
  }

  const json = (await res.json()) as {
    results?: { domain: string; found?: boolean; open_page_rank?: number | null; rank?: number | null }[];
  };
  const out: Record<string, DomainAuthority> = {};
  for (const r of json.results ?? []) {
    out[r.domain] = {
      score: r.found && r.open_page_rank != null ? Number(r.open_page_rank) : null,
      globalRank: r.rank != null ? Number(r.rank) : null,
    };
  }
  return out;
}
