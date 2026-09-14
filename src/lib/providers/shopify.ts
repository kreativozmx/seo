// Reads a Shopify store's public storefront JSON endpoints — no API key,
// no admin access, and no need to re-enter the URL (reuses the project's
// own domain). Most default Shopify themes expose /products.json and
// /collections.json publicly unless the merchant explicitly disabled them.

interface ShopifyImage {
  src?: string;
  alt?: string | null;
}

interface ShopifyVariant {
  price?: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  body_html?: string | null;
  vendor?: string;
  product_type?: string;
  tags?: string | string[];
  variants?: ShopifyVariant[];
  images?: ShopifyImage[];
  created_at?: string;
}

export interface FlaggedProduct {
  title: string;
  handle: string;
  issues: string[];
}

export interface NameCount {
  name: string;
  count: number;
}

export interface ShopifyAudit {
  isShopify: boolean;
  productCount: number;
  productCountIsMin: boolean; // true when Shopify's public API cap (1000) was hit — there may be more
  collectionCount: number;
  collectionCountIsMin: boolean; // true when the single-page cap (250) was hit — there may be more
  missingDescCount: number;
  missingImageCount: number;
  missingAltCount: number;
  thinTitleCount: number;
  flagged: FlaggedProduct[];
  priceMin: number | null;
  priceMax: number | null;
  avgPrice: number | null;
  totalVariants: number;
  topVendors: NameCount[];
  topProductTypes: NameCount[];
  topTags: NameCount[];
  newestProductAt: string | null;
}

// Some stores sit behind bot/WAF protection (Cloudflare, Shopify's own
// bot-protection apps, etc.) that blocks requests without a browser-like
// User-Agent, returning a 403/503 HTML challenge page instead of JSON even
// though the catalog itself is public. Sending a normal browser UA avoids
// most false negatives.
const BROWSER_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
};

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("json")) {
    return { ok: false, status: res.status, json: null };
  }
  try {
    return { ok: true, status: res.status, json: await res.json() };
  } catch {
    return { ok: false, status: res.status, json: null };
  }
}

// Shopify's public /products.json only ever serves up to 4 pages of 250
// (1000 products total), regardless of how many the store actually has —
// there's no way to page past that from the storefront API. If page 4
// comes back full, we can't know the real count, only that there's more.
const MAX_PRODUCT_PAGES = 4;

async function fetchAllProducts(
  domain: string
): Promise<{ products: ShopifyProduct[]; hasMore: boolean }> {
  const products: ShopifyProduct[] = [];
  let hasMore = false;
  for (let page = 1; page <= MAX_PRODUCT_PAGES; page++) {
    const { ok, status, json } = await fetchJson(
      `https://${domain}/products.json?limit=250&page=${page}`
    );
    if (!ok) {
      if (page === 1) {
        throw new Error(
          status === 401
            ? "La tienda tiene contraseña activada (Shopify Preferences > acceso a la tienda), asi que su catalogo no es publico."
            : `No se pudo leer /products.json (status ${status}). ¿Es una tienda Shopify y el catalogo es publico?`
        );
      }
      break;
    }
    const batch: ShopifyProduct[] =
      (json as { products?: ShopifyProduct[] })?.products ?? [];
    products.push(...batch);
    if (batch.length < 250) break;
    if (page === MAX_PRODUCT_PAGES) hasMore = true;
  }
  return { products, hasMore };
}

// /collections.json has no working pagination on the storefront API either
// — a single page, capped at 250.
async function fetchCollectionCount(domain: string): Promise<{ count: number; hasMore: boolean }> {
  try {
    const { ok, json } = await fetchJson(`https://${domain}/collections.json?limit=250`);
    if (!ok) return { count: 0, hasMore: false };
    const count = ((json as { collections?: unknown[] })?.collections ?? []).length;
    return { count, hasMore: count >= 250 };
  } catch {
    return { count: 0, hasMore: false };
  }
}

export interface ShopifyBasicInfo {
  isShopify: boolean;
  productCount: number;
  collectionCount: number;
}

// Lightweight check used when adding a competitor: single-page product
// count + collection count, without the full multi-page SEO audit.
export async function detectShopifyBasic(domain: string): Promise<ShopifyBasicInfo> {
  const { ok, json } = await fetchJson(`https://${domain}/products.json?limit=250`);
  if (!ok) {
    return { isShopify: false, productCount: 0, collectionCount: 0 };
  }
  const products: ShopifyProduct[] = (json as { products?: ShopifyProduct[] })?.products ?? [];
  const { count: collectionCount } = await fetchCollectionCount(domain);
  return {
    isShopify: true,
    productCount: products.length,
    collectionCount,
  };
}

const MIN_TITLE_LENGTH = 15;

function topCounts(values: string[], limit = 8): NameCount[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function auditShopifyStore(domain: string): Promise<ShopifyAudit> {
  const { products, hasMore: productCountIsMin } = await fetchAllProducts(domain);
  const { count: collectionCount, hasMore: collectionCountIsMin } = await fetchCollectionCount(domain);

  let missingDescCount = 0;
  let missingImageCount = 0;
  let missingAltCount = 0;
  let thinTitleCount = 0;
  const flagged: FlaggedProduct[] = [];

  const prices: number[] = [];
  let totalVariants = 0;
  const vendors: string[] = [];
  const productTypes: string[] = [];
  const tags: string[] = [];
  let newestProductAt: string | null = null;

  for (const p of products) {
    const issues: string[] = [];

    const hasDesc = Boolean(p.body_html && p.body_html.replace(/<[^>]*>/g, "").trim());
    if (!hasDesc) {
      missingDescCount++;
      issues.push("Sin descripcion");
    }

    const images = p.images ?? [];
    if (images.length === 0) {
      missingImageCount++;
      issues.push("Sin imagenes");
    } else if (images.some((img) => !img.alt || !img.alt.trim())) {
      missingAltCount++;
      issues.push("Imagen sin texto alternativo");
    }

    if ((p.title ?? "").trim().length < MIN_TITLE_LENGTH) {
      thinTitleCount++;
      issues.push("Titulo muy corto");
    }

    if (issues.length > 0 && flagged.length < 50) {
      flagged.push({ title: p.title, handle: p.handle, issues });
    }

    const variants = p.variants ?? [];
    totalVariants += variants.length;
    for (const v of variants) {
      const price = Number(v.price);
      if (!Number.isNaN(price) && price > 0) prices.push(price);
    }

    if (p.vendor) vendors.push(p.vendor);
    if (p.product_type) productTypes.push(p.product_type);
    const productTags = Array.isArray(p.tags)
      ? p.tags
      : typeof p.tags === "string"
      ? p.tags.split(",").map((t) => t.trim())
      : [];
    tags.push(...productTags.filter(Boolean));

    if (p.created_at && (!newestProductAt || p.created_at > newestProductAt)) {
      newestProductAt = p.created_at;
    }
  }

  return {
    isShopify: true,
    productCount: products.length,
    productCountIsMin,
    collectionCount,
    collectionCountIsMin,
    missingDescCount,
    missingImageCount,
    missingAltCount,
    thinTitleCount,
    flagged,
    priceMin: prices.length > 0 ? Math.min(...prices) : null,
    priceMax: prices.length > 0 ? Math.max(...prices) : null,
    avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    totalVariants,
    topVendors: topCounts(vendors),
    topProductTypes: topCounts(productTypes),
    topTags: topCounts(tags, 12),
    newestProductAt,
  };
}
