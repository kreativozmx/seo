import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isShopifyConfigured,
  buildShopifyAuthUrl,
  detectMyshopifyDomain,
} from "@/lib/shopifyAuth";

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

  const givenShop = req.nextUrl.searchParams.get("shop")?.trim();
  const shopDomain = givenShop || (await detectMyshopifyDomain(project.domain));

  if (!shopDomain) {
    return redirectTo("shopifyNeedsShopDomain=1");
  }

  const authUrl = buildShopifyAuthUrl(shopDomain, project.id);
  return NextResponse.redirect(authUrl);
}
