import { google } from "googleapis";

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GA_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
export const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";

// All Google OAuth flows (GSC, GA4, Business Profile) share one callback —
// registered once as the Authorized redirect URI in Google Cloud Console —
// and use `state` ("<projectId>:<product>") to tell products apart.
export type GoogleProduct = "gsc" | "ga" | "gbp";

export function encodeState(projectId: string, product: GoogleProduct) {
  return `${projectId}:${product}`;
}

export function decodeState(state: string): {
  projectId: string;
  product: GoogleProduct;
} {
  const [projectId, product] = state.split(":");
  return {
    projectId,
    product: (product as GoogleProduct) || "gsc",
  };
}

export function getRedirectUri() {
  // Must match, character for character, a redirect URI registered on the
  // OAuth client in Google Cloud Console.
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:3000/api/gsc/callback"
  );
}

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

export function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no estan configurados"
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, getRedirectUri());
}

export function oauthClientWithRefreshToken(refreshToken: string) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

// Shared by the /api/{gsc,ga,gbp}/auth routes: builds the redirect to
// Google's consent screen for a given product's scope, or bounces back to
// the project page with an error if the OAuth client isn't configured.
export function buildGoogleAuthRedirect(
  requestUrl: string,
  projectId: string,
  product: GoogleProduct,
  scope: string,
  errorParam: string
) {
  if (!isGoogleConfigured()) {
    return new URL(
      `/projects/${projectId}?${errorParam}=${encodeURIComponent(
        "Falta configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env.local"
      )}`,
      requestUrl
    );
  }

  const client = createOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [scope],
    state: encodeState(projectId, product),
  });

  return new URL(url);
}
