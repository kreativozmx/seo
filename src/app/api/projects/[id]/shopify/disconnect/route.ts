import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.project.update({
    where: { id: params.id },
    data: {
      shopifyShopDomain: null,
      shopifyAccessToken: null,
      shopifyRefreshToken: null,
      shopifyTokenExpiresAt: null,
      shopifyConnectedAt: null,
      shopifyOrders28d: null,
      shopifySales28d: null,
      shopifyCurrency: null,
      shopifySalesUpdatedAt: null,
    },
  });
  return NextResponse.json({ ok: true });
}
