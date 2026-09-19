import tls from "tls";
import { lookupDomain } from "@/lib/providers/whois";

// Automatic, key-less health checks of a live storefront. Everything here is
// read from the public site itself (HTTP/TLS/HTML), so it works for any
// domain and feeds the "Auto" items in Auditoria. Uncertain signals (e.g.
// analytics pixels, which Shopify injects outside the HTML) are deliberately
// NOT turned into audit checkboxes — a false "missing" would be misleading.
export interface SiteChecks {
  checkedAt: string;
  ssl: { valid: boolean; daysLeft: number | null; issuer: string | null; validTo: string | null; error: string | null };
  httpsRedirect: boolean | null;
  hsts: boolean | null;
  robots: { exists: boolean; blocksAll: boolean };
  sitemap: boolean;
  home: {
    status: number | null;
    ttfbMs: number | null;
    compressed: boolean | null;
    title: string | null;
    metaDescription: boolean;
    h1Count: number;
    canonical: boolean;
    viewport: boolean;
    lang: boolean;
    openGraph: boolean;
    favicon: boolean;
    noindex: boolean;
    jsonLdTypes: string[];
    socialLinks: string[];
  };
  productSchema: boolean | null;
  notFoundStatus: number | null;
  policies: { privacy: boolean; terms: boolean; shipping: boolean; returns: boolean; contact: boolean; faq: boolean; blog: boolean };
  domainDaysToExpire: number | null;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 ShopifyAuditBot/1.0";
const TIMEOUT = 9000;

async function get(url: string, init: RequestInit = {}) {
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT),
      ...init,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", ...(init.headers ?? {}) },
    });
  } catch {
    return null;
  }
}

function checkSsl(domain: string): Promise<SiteChecks["ssl"]> {
  return new Promise((resolve) => {
    const fail = (error: string) => resolve({ valid: false, daysLeft: null, issuer: null, validTo: null, error });
    const socket = tls.connect({ host: domain, port: 443, servername: domain, rejectUnauthorized: false, timeout: TIMEOUT }, () => {
      const cert = socket.getPeerCertificate();
      const authorized = socket.authorized;
      const authError = socket.authorizationError ? String(socket.authorizationError) : null;
      socket.end();
      if (!cert || !cert.valid_to) return fail("Sin certificado");
      const daysLeft = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000);
      const issuerField = cert.issuer as { O?: string; CN?: string } | undefined;
      resolve({
        valid: authorized && daysLeft > 0,
        daysLeft,
        issuer: issuerField?.O ?? issuerField?.CN ?? null,
        validTo: new Date(cert.valid_to).toISOString(),
        error: authorized ? null : authError,
      });
    });
    socket.on("timeout", () => {
      socket.destroy();
      fail("Tiempo agotado");
    });
    socket.on("error", (e) => fail(e.message));
  });
}

function metaContent(html: string, attr: "name" | "property", value: string): string | null {
  const re1 = new RegExp(`<meta[^>]+${attr}=["']${value}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${value}["']`, "i");
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null;
}

function jsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      const t = o["@type"];
      if (typeof t === "string") types.add(t);
      else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
      Object.values(o).forEach(walk);
    }
  };
  for (const m of Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      // ignore malformed JSON-LD block
    }
  }
  return Array.from(types);
}

function robotsBlocksAll(text: string): boolean {
  // Look at the User-agent: * group only.
  const groups = text.split(/\n\s*\n/);
  for (const g of groups) {
    if (/^\s*user-agent:\s*\*\s*$/im.test(g) && /^\s*disallow:\s*\/\s*$/im.test(g) && !/^\s*allow:\s*\/\s*$/im.test(g)) return true;
  }
  return false;
}

const POLICY_PATTERNS: Record<keyof SiteChecks["policies"], RegExp> = {
  privacy: /privacy|privacidad/i,
  terms: /terms|terminos|condiciones/i,
  shipping: /shipping|envio|entrega/i,
  returns: /refund|return|devolucion|reembolso|cambios-y/i,
  contact: /contact/i,
  faq: /faq|preguntas/i,
  blog: /\/blogs?\//i,
};
const POLICY_FALLBACKS: Record<string, string[]> = {
  privacy: ["/policies/privacy-policy"],
  terms: ["/policies/terms-of-service"],
  shipping: ["/policies/shipping-policy"],
  returns: ["/policies/refund-policy"],
  contact: ["/pages/contact", "/pages/contacto"],
  faq: ["/pages/faq", "/pages/preguntas-frecuentes"],
};

export async function runSiteChecks(domain: string): Promise<SiteChecks> {
  const origin = `https://${domain}`;

  const [ssl, httpRes, homeRes, robotsRes, sitemapRes, notFoundRes, whois] = await Promise.all([
    checkSsl(domain),
    get(`http://${domain}`, { redirect: "manual" }),
    (async () => {
      const t0 = Date.now();
      const res = await get(origin);
      return res ? { res, ttfbMs: Date.now() - t0 } : null;
    })(),
    get(`${origin}/robots.txt`),
    get(`${origin}/sitemap.xml`),
    get(`${origin}/pagina-inexistente-${Math.random().toString(36).slice(2, 10)}`),
    lookupDomain(domain).catch(() => null),
  ]);

  const httpsRedirect = httpRes
    ? httpRes.status >= 300 && httpRes.status < 400 && (httpRes.headers.get("location") ?? "").startsWith("https://")
    : null;

  const html = homeRes?.res.ok ? await homeRes.res.text().catch(() => "") : "";
  const hsts = homeRes ? homeRes.res.headers.has("strict-transport-security") : null;
  const encoding = homeRes?.res.headers.get("content-encoding") ?? "";

  const robotsText = robotsRes?.ok ? await robotsRes.text().catch(() => "") : "";
  const sitemapText = sitemapRes?.ok ? await sitemapRes.text().catch(() => "") : "";

  // hrefs on the homepage -> policy/blog/social detection
  const hrefs = Array.from(html.matchAll(/href=["']([^"'#]+)["']/gi), (m) => m[1]);
  const abs = (h: string) => {
    try {
      return new URL(h, origin);
    } catch {
      return null;
    }
  };
  const internal = hrefs.map(abs).filter((u): u is URL => !!u && u.hostname.replace(/^www\./, "") === domain);
  const socialLinks = Array.from(
    new Set(
      hrefs
        .map((h) => abs(h)?.hostname.replace(/^www\./, "") ?? "")
        .filter((h) => /(^|\.)(instagram|facebook|tiktok|youtube|twitter|x|pinterest|linkedin)\.com$/.test(h) && h !== "")
    )
  );

  async function policyExists(key: keyof SiteChecks["policies"]): Promise<boolean> {
    const fromLinks = internal.filter((u) => POLICY_PATTERNS[key].test(u.pathname));
    const candidates = Array.from(new Set([...fromLinks.map((u) => u.pathname), ...(POLICY_FALLBACKS[key] ?? [])])).slice(0, 4);
    if (key === "blog") return candidates.length > 0 || sitemapText.includes("sitemap_blogs");
    for (const path of candidates) {
      const res = await get(`${origin}${path}`, { method: "GET" });
      if (res?.ok) return true;
    }
    return false;
  }

  const policyKeys = Object.keys(POLICY_PATTERNS) as (keyof SiteChecks["policies"])[];
  const policyResults = await Promise.all(policyKeys.map(policyExists));
  const policies = Object.fromEntries(policyKeys.map((k, i) => [k, policyResults[i]])) as SiteChecks["policies"];

  // favicon: <link rel=icon> or /favicon.ico
  let favicon = /<link[^>]+rel=["'](?:shortcut )?icon["']|<link[^>]+rel=["']apple-touch-icon["']/i.test(html);
  if (!favicon) favicon = Boolean((await get(`${origin}/favicon.ico`))?.ok);

  // product structured data: sample one Shopify product page
  let productSchema: boolean | null = null;
  const productsJson = await get(`${origin}/products.json?limit=1`, { headers: { accept: "application/json" } });
  if (productsJson?.ok) {
    try {
      const handle = (await productsJson.json())?.products?.[0]?.handle as string | undefined;
      if (handle) {
        const page = await get(`${origin}/products/${handle}`);
        const pageHtml = page?.ok ? await page.text() : "";
        productSchema = jsonLdTypes(pageHtml).includes("Product");
      }
    } catch {
      productSchema = null;
    }
  }

  const types = jsonLdTypes(html);
  const robotsMeta = metaContent(html, "name", "robots") ?? "";

  return {
    checkedAt: new Date().toISOString(),
    ssl,
    httpsRedirect,
    hsts,
    robots: { exists: /user-agent/i.test(robotsText), blocksAll: robotsBlocksAll(robotsText) },
    sitemap: /<urlset|<sitemapindex/i.test(sitemapText),
    home: {
      status: homeRes?.res.status ?? null,
      ttfbMs: homeRes?.ttfbMs ?? null,
      compressed: homeRes ? /gzip|br|zstd|deflate/i.test(encoding) : null,
      title: html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null,
      metaDescription: Boolean(metaContent(html, "name", "description")?.trim()),
      h1Count: (html.match(/<h1[\s>]/gi) ?? []).length,
      canonical: /<link[^>]+rel=["']canonical["']/i.test(html),
      viewport: Boolean(metaContent(html, "name", "viewport")),
      lang: /<html[^>]+lang=/i.test(html),
      openGraph: Boolean(metaContent(html, "property", "og:title")),
      favicon,
      noindex: /noindex/i.test(robotsMeta),
      jsonLdTypes: types,
      socialLinks,
    },
    productSchema,
    notFoundStatus: notFoundRes?.status ?? null,
    policies,
    domainDaysToExpire: whois?.daysToExpire ?? null,
  };
}
