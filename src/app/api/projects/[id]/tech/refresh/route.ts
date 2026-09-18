import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectTechnologies } from "@/lib/providers/techDetect";

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
    const audit = await detectTechnologies(project.domain);

    await prisma.project.update({
      where: { id: project.id },
      data: {
        techDetectedJson: JSON.stringify(audit.detected),
        techCheckedAt: new Date(),
      },
    });

    return NextResponse.json({ detected: audit.detected });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
