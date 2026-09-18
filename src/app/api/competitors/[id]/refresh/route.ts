import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditShopifyStore } from "@/lib/providers/shopify";
import { detectTechnologies } from "@/lib/providers/techDetect";
import {
  fetchDomainTrafficOverview,
  fetchRankedKeywords,
} from "@/lib/providers/dataforseoLabs";

export const maxDuration = 60;

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
    const audit = await auditShopifyStore(competitor.domain);
    data.ecommerceIsShopify = audit.isShopify;
    data.ecommerceProductCount = audit.productCount;
    data.ecommerceCollectionCount = audit.collectionCount;
    data.ecommercePriceMin = audit.priceMin;
    data.ecommercePriceMax = audit.priceMax;
    data.ecommerceAvgPrice = audit.avgPrice;
    data.ecommerceTotalVariants = audit.totalVariants;
    data.ecommerceTopVendorsJson = JSON.stringify(audit.topVendors);
    data.ecommerceTopTypesJson = JSON.stringify(audit.topProductTypes);
    data.ecommerceTopTagsJson = JSON.stringify(audit.topTags);
    data.ecommerceTopSellingJson = JSON.stringify(audit.topSelling);
    data.ecommerceNewestProductAt = audit.newestProductAt ? new Date(audit.newestProductAt) : null;
    data.ecommerceCheckedAt = new Date();
  } catch (err) {
    data.ecommerceIsShopify = false;
    data.ecommerceCheckedAt = new Date();
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
      100
    );
    data.rankedKeywordsJson = JSON.stringify(ranked);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "Error al obtener keywords posicionadas");
  }

  const updated = await prisma.competitor.update({
    where: { id: competitor.id },
    data,
  });

  // Keep a dated snapshot (same data, no extra DataForSEO call) so the
  // Competencia chart can compare "now" against an earlier date later on.
  if (data.organicTrafficEstimate !== undefined) {
    await prisma.trafficSnapshot.create({
      data: {
        projectId: competitor.projectId,
        domain: competitor.domain,
        organicKeywords: data.organicKeywords as number | null,
        organicTrafficEstimate: data.organicTrafficEstimate as number | null,
        trafficValueEstimate: data.trafficValueEstimate as number | null,
      },
    });
  }

  return NextResponse.json({ competitor: updated, errors });
}
