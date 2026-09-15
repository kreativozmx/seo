import { prisma } from "@/lib/prisma";
import { refreshShopifyToken } from "@/lib/shopifyAuth";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // refresh a bit before it actually expires

// Returns a Shopify access token good to use right now — silently
// refreshing (and persisting the new token) if this project has an
// expiring-style token that's about to run out. Old-style non-expiring
// tokens (shopifyTokenExpiresAt null) pass through untouched.
export async function getValidShopifyAccessToken(project: {
  id: string;
  shopifyShopDomain: string | null;
  shopifyAccessToken: string | null;
  shopifyRefreshToken: string | null;
  shopifyTokenExpiresAt: Date | null;
}): Promise<string> {
  if (!project.shopifyShopDomain || !project.shopifyAccessToken) {
    throw new Error("Este proyecto no tiene Shopify Admin conectado");
  }

  const expiringSoon =
    project.shopifyTokenExpiresAt != null &&
    project.shopifyTokenExpiresAt.getTime() - EXPIRY_BUFFER_MS < Date.now();

  if (!expiringSoon) {
    return project.shopifyAccessToken;
  }

  if (!project.shopifyRefreshToken) {
    throw new Error(
      "El token de Shopify expiro y no hay refresh token guardado — vuelve a conectar Shopify."
    );
  }

  const refreshed = await refreshShopifyToken(
    project.shopifyShopDomain,
    project.shopifyRefreshToken
  );

  await prisma.project.update({
    where: { id: project.id },
    data: {
      shopifyAccessToken: refreshed.accessToken,
      shopifyRefreshToken: refreshed.refreshToken,
      shopifyTokenExpiresAt: refreshed.expiresAt,
    },
  });

  return refreshed.accessToken;
}
