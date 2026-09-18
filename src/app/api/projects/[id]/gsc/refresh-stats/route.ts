import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshGscStats } from "@/lib/gscImport";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  try {
    const updated = await refreshGscStats(project);
    return NextResponse.json({
      gscClicks28d: updated.gscClicks28d,
      gscImpressions28d: updated.gscImpressions28d,
      gscAvgPosition28d: updated.gscAvgPosition28d,
      gscStatsUpdatedAt: updated.gscStatsUpdatedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
