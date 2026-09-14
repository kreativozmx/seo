import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchKnowledgeGraph } from "@/lib/providers/knowledgeGraph";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  try {
    const result = await searchKnowledgeGraph(project.name);

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        kgFound: result.found,
        kgName: result.name,
        kgDescription: result.description,
        kgImageUrl: result.imageUrl,
        kgScore: result.score,
        kgCheckedAt: new Date(),
      },
    });

    return NextResponse.json({
      kgFound: updated.kgFound,
      kgName: updated.kgName,
      kgDescription: updated.kgDescription,
      kgImageUrl: updated.kgImageUrl,
      kgScore: updated.kgScore,
      kgCheckedAt: updated.kgCheckedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
