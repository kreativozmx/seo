import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchDomainTrafficOverview } from "@/lib/providers/dataforseoLabs";

// Same estimate source used for competitors, but for the project's own
// domain — so the Competencia comparison chart/table can plot "you" next
// to the competitors on equal footing.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  try {
    const traffic = await fetchDomainTrafficOverview(
      project.domain,
      project.locationCode,
      project.languageCode
    );

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        domainOrganicKeywords: traffic.organicKeywords,
        domainOrganicTrafficEstimate: traffic.organicTrafficEstimate,
        domainTrafficValueEstimate: traffic.trafficValueEstimate,
        domainTrafficCheckedAt: new Date(),
      },
    });

    return NextResponse.json({
      domainOrganicKeywords: updated.domainOrganicKeywords,
      domainOrganicTrafficEstimate: updated.domainOrganicTrafficEstimate,
      domainTrafficValueEstimate: updated.domainTrafficValueEstimate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
