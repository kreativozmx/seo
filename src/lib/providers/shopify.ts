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
  topSelling: TopSellingResult;
}

export interface TopSellingResult {
  // "merchant": a real collection the store itself curates as its
  // bestsellers/most-popular list (as authoritative as the public catalog
  // gets without Admin API access). "algorithm": Shopify's own
  // sort_by=best-selling on the auto "all" collection — this is Shopify's
  // opaque, sometimes stale ranking, not a guaranteed real sales order.
  // "none": neither was available.
  source: "merchant" | "algorithm" | "none";
  collectionTitle: string | null;
  items: { title: string; handle: string }[];
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

interface ShopifyCollection {
  title?: string;
  handle?: string;
}

// /collections.json has no working pagination on the storefront API either
// — a single page, capped at 250. Fetched once and reused both for the
// collection count and to look for a merchant-curated bestsellers list.
async function fetchCollectionsList(domain: string): Promise<{ collections: ShopifyCollection[]; hasMore: boolean }> {
  try {
    const { ok, json } = await fetchJson(`https://${domain}/collections.json?limit=250`);
    if (!ok) return { collections: [], hasMore: false };
    const collections = (json as { collections?: ShopifyCollection[] })?.collections ?? [];
    return { collections, hasMore: collections.length >= 250 };
  } catch {
    return { collections: [], hasMore: false };
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
  const { collections } = await fetchCollectionsList(domain);
  const collectionCount = collections.length;
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

// Keywords (accent/case-insensitive) that show up in a merchant's own
// "bestsellers" collection name across the storefronts we've seen —
// Spanish and English. A real merchant-curated list like this is a much
// stronger signal than Shopify's opaque sort_by=best-selling order, since
// it reflects what the store owner actually chose to feature as popular.
const BESTSELLER_NAME_HINTS = [
  "best sell",
  "bestsell",
  "best-sell",
  "mas vendid",
  "más vendid",
  "top ventas",
  "top venta",
  "populares",
  "lo mas popular",
  "lo más popular",
  "favoritos",
];

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function findBestsellerCollection(collections: ShopifyCollection[]): ShopifyCollection | null {
  for (const c of collections) {
    const haystack = stripAccents(`${c.title ?? ""} ${c.handle ?? ""}`.toLowerCase());
    if (BESTSELLER_NAME_HINTS.some((hint) => haystack.includes(stripAccents(hint)))) {
      return c;
    }
  }
  return null;
}

async function fetchProductsForCollection(
  domain: string,
  handle: string,
  limit: number,
  sortBy?: string
): Promise<ShopifyProduct[]> {
  const sortParam = sortBy ? `&sort_by=${sortBy}` : "";
  const { ok, json } = await fetchJson(
    `https://${domain}/collections/${handle}/products.json?limit=${limit}${sortParam}`
  );
  if (!ok) return [];
  return (json as { products?: ShopifyProduct[] })?.products ?? [];
}

// Best-effort "most popular products" without Admin API access. Prefers a
// collection the merchant themselves curates as bestsellers/popular (their
// own judgment, informed by real sales they can see in the admin) over
// Shopify's public sort_by=best-selling, which several merchants have
// reported as unreliable/stale on their storefronts.
async function fetchTopSelling(
  domain: string,
  collections: ShopifyCollection[],
  limit = 5
): Promise<TopSellingResult> {
  const bestsellerCollection = findBestsellerCollection(collections);
  if (bestsellerCollection?.handle) {
    try {
      const products = await fetchProductsForCollection(domain, bestsellerCollection.handle, limit);
      if (products.length > 0) {
        return {
          source: "merchant",
          collectionTitle: bestsellerCollection.title ?? bestsellerCollection.handle,
          items: products.map((p) => ({ title: p.title, handle: p.handle })),
        };
      }
    } catch {
      // fall through to the algorithmic sort below
    }
  }

  try {
    const products = await fetchProductsForCollection(domain, "all", limit, "best-selling");
    if (products.length > 0) {
      return { source: "algorithm", collectionTitle: null, items: products.map((p) => ({ title: p.title, handle: p.handle })) };
    }
  } catch {
    // ignore — falls through to "none" below
  }

  return { source: "none", collectionTitle: null, items: [] };
}

export async function auditShopifyStore(domain: string): Promise<ShopifyAudit> {
  const { products, hasMore: productCountIsMin } = await fetchAllProducts(domain);
  const { collections, hasMore: collectionCountIsMin } = await fetchCollectionsList(domain);
  const collectionCount = collections.length;
  const topSelling = await fetchTopSelling(domain, collections);

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
    topSelling,
  };
}
