import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSiteChecks } from "@/lib/providers/siteChecks";

export const maxDuration = 60;

// Runs the automatic site checks and stores them; Auditoria reads the cached
// result to tick its "Auto" items.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, domain: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  try {
    const checks = await runSiteChecks(project.domain);
    await prisma.project.update({
      where: { id: project.id },
      data: { siteChecksJson: JSON.stringify(checks), siteChecksUpdatedAt: new Date() },
    });
    return NextResponse.json({ checks });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
