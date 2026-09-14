// Reads a WooCommerce store's public Store API (/wp-json/wc/store/v1) —
// no API key needed, it's the same endpoint WooCommerce's own checkout
// blocks use client-side. Only works if the site is WordPress+WooCommerce
// and the store owner hasn't disabled the REST API.

interface WooProduct {
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  images?: { src: string; alt?: string }[];
  prices?: { price?: string; currency_minor_unit?: number };
  categories?: { name: string }[];
  tags?: { name: string }[];
  date_created?: string;
}

export interface WooAudit {
  isWooCommerce: boolean;
  productCount: number;
  missingDescCount: number;
  missingImageCount: number;
  missingAltCount: number;
  priceMin: number | null;
  priceMax: number | null;
  avgPrice: number | null;
  topCategories: { name: string; count: number }[];
  flagged: { title: string; handle: string; issues: string[] }[];
}

function topCounts(values: string[], limit = 8) {
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

const BROWSER_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
};

export async function auditWooCommerceStore(domain: string): Promise<WooAudit> {
  const res = await fetch(
    `https://${domain}/wp-json/wc/store/v1/products?per_page=100`,
    { headers: BROWSER_HEADERS }
  );

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("json")) {
    throw new Error(
      `No se pudo leer el catalogo de WooCommerce (status ${res.status}). El Store API puede estar desactivado o el sitio no usa WooCommerce.`
    );
  }

  const products: WooProduct[] = await res.json();

  let missingDescCount = 0;
  let missingImageCount = 0;
  let missingAltCount = 0;
  const prices: number[] = [];
  const categories: string[] = [];
  const flagged: { title: string; handle: string; issues: string[] }[] = [];

  for (const p of products) {
    const issues: string[] = [];
    const desc = (p.description || p.short_description || "").replace(/<[^>]*>/g, "").trim();
    if (!desc) {
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

    if (issues.length > 0 && flagged.length < 50) {
      flagged.push({ title: p.name, handle: p.slug, issues });
    }

    if (p.prices?.price) {
      const minorUnit = p.prices.currency_minor_unit ?? 2;
      const price = Number(p.prices.price) / Math.pow(10, minorUnit);
      if (!Number.isNaN(price) && price > 0) prices.push(price);
    }

    for (const c of p.categories ?? []) {
      if (c.name) categories.push(c.name);
    }
  }

  return {
    isWooCommerce: true,
    productCount: products.length,
    missingDescCount,
    missingImageCount,
    missingAltCount,
    priceMin: prices.length > 0 ? Math.min(...prices) : null,
    priceMax: prices.length > 0 ? Math.max(...prices) : null,
    avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    topCategories: topCounts(categories),
    flagged,
  };
}
