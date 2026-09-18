import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchDomainTrafficOverview, fetchRankedKeywords } from "@/lib/providers/dataforseoLabs";

export const maxDuration = 60;

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
    const [traffic, rankedKeywords] = await Promise.all([
      fetchDomainTrafficOverview(project.domain, project.locationCode, project.languageCode),
      fetchRankedKeywords(project.domain, project.locationCode, project.languageCode, 100),
    ]);

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        domainOrganicKeywords: traffic.organicKeywords,
        domainOrganicTrafficEstimate: traffic.organicTrafficEstimate,
        domainPaidKeywords: traffic.paidKeywords,
        domainPaidTrafficEstimate: traffic.paidTrafficEstimate,
        domainTrafficValueEstimate: traffic.trafficValueEstimate,
        domainRankedKeywordsJson: JSON.stringify(rankedKeywords),
        domainTrafficCheckedAt: new Date(),
      },
    });

    // Keep a dated snapshot (same data, no extra DataForSEO call) so the
    // Competencia chart can compare "now" against an earlier date later on.
    await prisma.trafficSnapshot.create({
      data: {
        projectId: project.id,
        domain: project.domain,
        organicKeywords: traffic.organicKeywords,
        organicTrafficEstimate: traffic.organicTrafficEstimate,
        trafficValueEstimate: traffic.trafficValueEstimate,
      },
    });

    return NextResponse.json({
      domainOrganicKeywords: updated.domainOrganicKeywords,
      domainOrganicTrafficEstimate: updated.domainOrganicTrafficEstimate,
      domainPaidKeywords: updated.domainPaidKeywords,
      domainPaidTrafficEstimate: updated.domainPaidTrafficEstimate,
      domainTrafficValueEstimate: updated.domainTrafficValueEstimate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
