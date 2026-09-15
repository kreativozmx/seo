import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchShopifySales } from "@/lib/providers/shopifyAdmin";
import { getValidShopifyAccessToken } from "@/lib/shopifyToken";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project?.shopifyAccessToken || !project.shopifyShopDomain) {
    return NextResponse.json(
      { error: "Este proyecto no tiene Shopify Admin conectado" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidShopifyAccessToken(project);
    const sales = await fetchShopifySales(project.shopifyShopDomain, accessToken, 28);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        shopifyOrders28d: sales.orders,
        shopifySales28d: sales.totalSales,
        shopifyCurrency: sales.currency,
        shopifySalesUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
