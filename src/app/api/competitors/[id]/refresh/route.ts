import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectShopifyBasic } from "@/lib/providers/shopify";
import { detectTechnologies } from "@/lib/providers/techDetect";
import {
  fetchDomainTrafficOverview,
  fetchRankedKeywords,
} from "@/lib/providers/dataforseoLabs";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const competitor = await prisma.competitor.findUnique({
    where: { id: params.id },
    include: { project: true },
  });
  if (!competitor) {
    return NextResponse.json({ error: "Competidor no encontrado" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  try {
    const info = await detectShopifyBasic(competitor.domain);
    data.ecommerceIsShopify = info.isShopify;
    data.ecommerceProductCount = info.productCount;
    data.ecommerceCollectionCount = info.collectionCount;
    data.ecommerceCheckedAt = new Date();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Error al leer catalogo");
  }

  try {
    const tech = await detectTechnologies(competitor.domain);
    data.techDetectedJson = JSON.stringify(tech.detected);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Error al detectar tecnologias");
  }

  try {
    const traffic = await fetchDomainTrafficOverview(
      competitor.domain,
      competitor.project.locationCode,
      competitor.project.languageCode
    );
    data.organicKeywords = traffic.organicKeywords;
    data.organicTrafficEstimate = traffic.organicTrafficEstimate;
    data.paidKeywords = traffic.paidKeywords;
    data.paidTrafficEstimate = traffic.paidTrafficEstimate;
    data.trafficValueEstimate = traffic.trafficValueEstimate;
    data.trafficCheckedAt = new Date();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Error al estimar trafico");
  }

  try {
    const ranked = await fetchRankedKeywords(
      competitor.domain,
      competitor.project.locationCode,
      competitor.project.languageCode,
      20
    );
    data.rankedKeywordsJson = JSON.stringify(ranked);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Error al obtener keywords posicionadas");
  }

  const updated = await prisma.competitor.update({
    where: { id: competitor.id },
    data,
  });

  return NextResponse.json({ competitor: updated, errors });
}
