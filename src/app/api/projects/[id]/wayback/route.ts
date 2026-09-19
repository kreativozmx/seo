import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeWayback } from "@/lib/providers/wayback";

export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, domain: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  try {
    const report = await analyzeWayback(project.domain);
    await prisma.project.update({
      where: { id: project.id },
      data: { waybackJson: JSON.stringify(report), waybackUpdatedAt: new Date() },
    });
    return NextResponse.json({ report });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 502 });
  }
}
