import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchPageSpeed } from "@/lib/providers/pagespeed";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  try {
    const result = await fetchPageSpeed(`https://${project.domain}/`, "mobile");

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        psiPerformanceScore: result.performanceScore,
        psiLcpMs: result.lcpMs != null ? Math.round(result.lcpMs) : null,
        psiCls: result.cls,
        psiInpMs: result.inpMs != null ? Math.round(result.inpMs) : null,
        psiFieldDataSource: result.source,
        psiIssuesJson: JSON.stringify(result.issues),
        psiUpdatedAt: new Date(),
      },
    });

    return NextResponse.json({
      psiPerformanceScore: updated.psiPerformanceScore,
      psiLcpMs: updated.psiLcpMs,
      psiCls: updated.psiCls,
      psiInpMs: updated.psiInpMs,
      psiFieldDataSource: updated.psiFieldDataSource,
      psiUpdatedAt: updated.psiUpdatedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
