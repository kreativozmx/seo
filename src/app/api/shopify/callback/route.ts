import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyShopifyHmac, exchangeShopifyCode } from "@/lib/shopifyAuth";
import { fetchShopifySales } from "@/lib/providers/shopifyAdmin";

export async function GET(req: NextRequest) {
  const shop = req.nextUrl.searchParams.get("shop");
  const code = req.nextUrl.searchParams.get("code");
  const projectId = req.nextUrl.searchParams.get("state");

  if (!projectId) {
    return NextResponse.json({ error: "Missing state" }, { status: 400 });
  }

  const redirectTo = (query: string) =>
    NextResponse.redirect(new URL(`/projects/${projectId}?${query}`, req.url));

  if (!shop || !code) {
    return redirectTo(
      `shopifyError=${encodeURIComponent("Faltan parametros en la respuesta de Shopify")}`
    );
  }

  if (!verifyShopifyHmac(req.nextUrl.searchParams)) {
    return redirectTo(
      `shopifyError=${encodeURIComponent("No se pudo verificar la firma de Shopify")}`
    );
  }

  try {
    const accessToken = await exchangeShopifyCode(shop, code);
    const sales = await fetchShopifySales(shop, accessToken, 28);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        shopifyShopDomain: shop,
        shopifyAccessToken: accessToken,
        shopifyConnectedAt: new Date(),
        shopifyOrders28d: sales.orders,
        shopifySales28d: sales.totalSales,
        shopifyCurrency: sales.currency,
        shopifySalesUpdatedAt: new Date(),
      },
    });

    return redirectTo("shopifyConnected=1");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return redirectTo(`shopifyError=${encodeURIComponent(message)}`);
  }
}
