import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import { fetchGbpSummary } from "@/lib/providers/businessProfile";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  if (!project.gbpRefreshToken) {
    return NextResponse.json(
      { error: "Este proyecto no tiene Business Profile conectado" },
      { status: 400 }
    );
  }
  if (!project.gbpLocationName) {
    return NextResponse.json(
      { error: "Falta indicar el location de Business Profile" },
      { status: 400 }
    );
  }

  try {
    const client = oauthClientWithRefreshToken(project.gbpRefreshToken);
    const summary = await fetchGbpSummary(client, project.gbpLocationName, 28);

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        gbpImpressions28d: summary.impressions,
        gbpCalls28d: summary.calls,
        gbpWebsiteClicks28d: summary.websiteClicks,
        gbpDirectionRequests28d: summary.directionRequests,
        gbpStatsUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({
      gbpImpressions28d: updated.gbpImpressions28d,
      gbpCalls28d: updated.gbpCalls28d,
      gbpWebsiteClicks28d: updated.gbpWebsiteClicks28d,
      gbpDirectionRequests28d: updated.gbpDirectionRequests28d,
      gbpStatsUpdatedAt: updated.gbpStatsUpdatedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
