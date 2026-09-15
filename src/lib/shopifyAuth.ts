import crypto from "crypto";

// Standard Shopify OAuth ("Install the app") flow — the merchant clicks
// one button, approves on Shopify's own consent screen, and we get an
// access token back. No custom app, no manual token creation on their
// side. Requires a Shopify app registered once by the developer (Partner
// Dashboard) — see README for setup.

const SCOPES = "read_orders";

export function isShopifyConfigured() {
  return Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET);
}

export function getShopifyRedirectUri() {
  return (
    process.env.SHOPIFY_REDIRECT_URI ||
    "http://localhost:3000/api/shopify/callback"
  );
}

export function buildShopifyAuthUrl(shopDomain: string, state: string) {
  const clientId = process.env.SHOPIFY_API_KEY;
  if (!clientId) throw new Error("SHOPIFY_API_KEY no esta configurada");

  const params = new URLSearchParams({
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: getShopifyRedirectUri(),
    state,
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

export interface ShopifyTokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

// Shopify stopped accepting non-expiring offline tokens for newer apps'
// Admin API requests — `expiring: true` here requests the new-style token
// (1h access token + 90-day refresh token) instead of the old permanent one.
// https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens
export async function exchangeShopifyCode(
  shopDomain: string,
  code: string
): Promise<ShopifyTokenResult> {
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_API_KEY / SHOPIFY_API_SECRET no estan configuradas");
  }

  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      expiring: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify token exchange failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string) ?? null,
    expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000) : null,
  };
}

// Exchanges a refresh token for a fresh access token (and a new refresh
// token — Shopify rotates it every time). Same endpoint, different
// grant_type.
export async function refreshShopifyToken(
  shopDomain: string,
  refreshToken: string
): Promise<ShopifyTokenResult> {
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SHOPIFY_API_KEY / SHOPIFY_API_SECRET no estan configuradas");
  }

  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify token refresh failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string) ?? refreshToken,
    expiresAt: json.expires_in ? new Date(Date.now() + Number(json.expires_in) * 1000) : null,
  };
}

// Verifies the HMAC Shopify signs OAuth callback query params with, per
// https://shopify.dev/docs/apps/auth/oauth/getting-started#verify-the-installation-request
export function verifyShopifyHmac(searchParams: URLSearchParams): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return false;

  const hmac = searchParams.get("hmac");
  if (!hmac) return false;

  const pairs: string[] = [];
  searchParams.forEach((value, key) => {
    if (key === "hmac" || key === "signature") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const message = pairs.join("&");

  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  } catch {
    return false;
  }
}

// Best-effort: finds the xxx.myshopify.com handle for a store that's on a
// custom domain, by looking for it in the storefront's own HTML (themes
// commonly expose `Shopify.shop = "xxx.myshopify.com"` client-side).
export async function detectMyshopifyDomain(domain: string): Promise<string | null> {
  if (domain.endsWith(".myshopify.com")) return domain;

  try {
    const res = await fetch(`https://${domain}/`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ShopifyAuditBot/1.0)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(/Shopify\.shop\s*=\s*["']([a-z0-9-]+\.myshopify\.com)["']/i) ||
      html.match(/"myshopifyDomain"\s*:\s*"([a-z0-9-]+\.myshopify\.com)"/i) ||
      html.match(/([a-z0-9-]+\.myshopify\.com)/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
