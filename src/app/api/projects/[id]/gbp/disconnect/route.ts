import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.project.update({
    where: { id: params.id },
    data: {
      gbpRefreshToken: null,
      gbpLocationName: null,
      gbpConnectedAt: null,
      gbpImpressions28d: null,
      gbpCalls28d: null,
      gbpWebsiteClicks28d: null,
      gbpDirectionRequests28d: null,
      gbpStatsUpdatedAt: null,
    },
  });
  return NextResponse.json({ ok: true });
}
