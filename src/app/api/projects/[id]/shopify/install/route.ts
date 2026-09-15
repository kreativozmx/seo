import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isShopifyConfigured,
  buildShopifyAuthUrl,
  detectMyshopifyDomain,
} from "@/lib/shopifyAuth";
import { normalizeShopifyShopInput } from "@/lib/shopifyDomain";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const redirectTo = (query: string) =>
    NextResponse.redirect(new URL(`/projects/${project.id}?${query}`, req.url));

  if (!isShopifyConfigured()) {
    return redirectTo(
      `shopifyError=${encodeURIComponent(
        "Falta configurar SHOPIFY_API_KEY y SHOPIFY_API_SECRET en .env.local"
      )}`
    );
  }

  const rawShop = req.nextUrl.searchParams.get("shop")?.trim();
  const givenShop = rawShop ? normalizeShopifyShopInput(rawShop) : "";

  // Already a myshopify.com handle (typed directly, or resolved from an
  // admin.shopify.com/store/xxx URL) — use it as-is. Otherwise it's a
  // custom domain (or nothing was typed), so resolve it the same way we
  // do for the project's own domain.
  const shopDomain = givenShop.endsWith(".myshopify.com")
    ? givenShop
    : await detectMyshopifyDomain(givenShop || project.domain);

  if (!shopDomain) {
    return redirectTo("shopifyNeedsShopDomain=1");
  }

  const authUrl = buildShopifyAuthUrl(shopDomain, project.id);
  return NextResponse.redirect(authUrl);
}
