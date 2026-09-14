import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSafeBrowsing } from "@/lib/providers/safeBrowsing";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  try {
    const result = await checkSafeBrowsing(project.domain);

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        safeBrowsingClean: result.clean,
        safeBrowsingThreats: result.threats.join(", ") || null,
        safeBrowsingCheckedAt: new Date(),
      },
    });

    return NextResponse.json({
      safeBrowsingClean: updated.safeBrowsingClean,
      safeBrowsingThreats: updated.safeBrowsingThreats,
      safeBrowsingCheckedAt: updated.safeBrowsingCheckedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
