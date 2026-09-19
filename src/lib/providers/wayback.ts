// Wayback Machine (archive.org) — free, no key, but rate-limited (HTTP 429),
// so this makes as few archive.org calls as possible (2 CDX queries) and
// spends the rest of its effort checking URLs on the live site itself.
export interface WaybackLostUrl {
  path: string;
  archivedAt: string; // ISO date of the archived capture
  archiveUrl: string;
  status: number | null; // current HTTP status on the live site
  kind: "gone" | "to-home";
}

export interface WaybackReport {
  firstCapture: string | null;
  lastCapture: string | null;
  years: number[];
  candidatesChecked: number;
  lost: WaybackLostUrl[];
  partial: boolean;
  checkedAt: string;
}

const ASSET_RE = /\.(?:js|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|swf|pdf|zip|json|xml|txt|mp4|mp3)(?:$|\?)/i;
const SKIP_RE = /\/(?:cart|checkout|account|cdn|admin|search|apps|services|tools|\.well-known)(?:\/|$)|[?&](?:page|sort_by|variant|view)=/i;

function tsToIso(ts: string) {
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}

async function cdx(params: Record<string, string | string[]>, timeoutMs: number): Promise<string[][] | null> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) (Array.isArray(v) ? v : [v]).forEach((x) => qs.append(k, x));
  try {
    const res = await fetch(`http://web.archive.org/cdx/search/cdx?${qs.toString()}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "ShopifyAudit/1.0 (+https://shopifyaudit.com)" },
    });
    if (res.status === 429) throw new Error("Wayback Machine limita las consultas ahora mismo; intenta de nuevo en un minuto.");
    if (!res.ok) return null;
    const json = (await res.json()) as string[][];
    return json.slice(1); // drop header row
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Wayback")) throw err;
    return null;
  }
}

export async function analyzeWayback(domain: string, maxCheck = 40): Promise<WaybackReport> {
  const yearly = await cdx({ url: domain, output: "json", fl: "timestamp", collapse: "timestamp:4" }, 20000);
  const stamps = (yearly ?? []).map((r) => r[0]);
  const years = Array.from(new Set(stamps.map((s) => Number(s.slice(0, 4)))));

  // Prefer store-style content URLs; fall back to any archived HTML page.
  const contentRows =
    (await cdx(
      {
        url: `${domain}/*`,
        output: "json",
        fl: "timestamp,original",
        filter: ["statuscode:200", "mimetype:text/html", "original:.*/(products|collections|blogs|pages)/.*"],
        collapse: "urlkey",
        limit: "500",
      },
      30000
    )) ?? [];
  let rows = contentRows;
  let partial = yearly == null;
  if (rows.length < 30) {
    const generic = await cdx(
      { url: `${domain}/*`, output: "json", fl: "timestamp,original", filter: ["statuscode:200", "mimetype:text/html"], collapse: "urlkey", limit: "500" },
      30000
    );
    if (generic == null) partial = true;
    rows = [...rows, ...(generic ?? [])];
  }

  // Normalize to unique paths worth checking.
  const seen = new Set<string>();
  const candidates: { path: string; ts: string }[] = [];
  for (const [ts, original] of rows) {
    let path: string;
    try {
      const u = new URL(original);
      path = decodeURI(u.pathname.replace(/\/+$/, "")) || "/";
      if (u.search && /[?&](?:page|sort_by|variant|view|q)=/.test(u.search)) continue;
    } catch {
      continue;
    }
    if (path === "/" || ASSET_RE.test(path) || SKIP_RE.test(path)) continue;
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ path, ts });
  }

  // Spread the sample across the list instead of taking only the alphabetical head.
  const step = Math.max(1, Math.floor(candidates.length / maxCheck));
  const sample = candidates.filter((_, i) => i % step === 0).slice(0, maxCheck);

  const lost: WaybackLostUrl[] = [];
  for (let i = 0; i < sample.length; i += 8) {
    const batch = sample.slice(i, i + 8);
    const results = await Promise.all(
      batch.map(async ({ path, ts }) => {
        try {
          const res = await fetch(`https://${domain}${path}`, {
            redirect: "follow",
            signal: AbortSignal.timeout(8000),
            headers: { "user-agent": "Mozilla/5.0 ShopifyAuditBot/1.0" },
          });
          const finalPath = new URL(res.url).pathname.replace(/\/+$/, "") || "/";
          if (res.status === 404 || res.status === 410) return { path, ts, status: res.status, kind: "gone" as const };
          if (res.ok && finalPath === "/" && path !== "/") return { path, ts, status: res.status, kind: "to-home" as const };
        } catch {
          // unreachable now — skip, don't guess
        }
        return null;
      })
    );
    for (const r of results) {
      if (r)
        lost.push({
          path: r.path,
          archivedAt: tsToIso(r.ts),
          archiveUrl: `https://web.archive.org/web/${r.ts}/https://${domain}${r.path}`,
          status: r.status,
          kind: r.kind,
        });
    }
  }

  return {
    firstCapture: stamps[0] ? tsToIso(stamps[0]) : null,
    lastCapture: stamps.length ? tsToIso(stamps[stamps.length - 1]) : null,
    years,
    candidatesChecked: sample.length,
    lost,
    partial,
    checkedAt: new Date().toISOString(),
  };
}
