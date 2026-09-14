import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.project.update({
    where: { id: params.id },
    data: {
      gaRefreshToken: null,
      gaPropertyId: null,
      gaConnectedAt: null,
      gaSessions28d: null,
      gaUsers28d: null,
      gaConversions28d: null,
      gaStatsUpdatedAt: null,
    },
  });
  return NextResponse.json({ ok: true });
}
