import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findBrokenLinks } from "@/lib/providers/brokenLinks";

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
    const { checked, broken } = await findBrokenLinks(project.domain);

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        brokenLinksJson: JSON.stringify(broken),
        brokenLinksChecked: checked,
        brokenLinksCheckedAt: new Date(),
      },
    });

    return NextResponse.json({
      checked: updated.brokenLinksChecked,
      brokenCount: broken.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
