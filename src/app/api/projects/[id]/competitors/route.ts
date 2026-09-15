import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain } from "@/lib/domain";
import { auditShopifyStore } from "@/lib/providers/shopify";
import { detectTechnologies } from "@/lib/providers/techDetect";
import {
  fetchDomainTrafficOverview,
  fetchRankedKeywords,
} from "@/lib/providers/dataforseoLabs";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const { domain, name } = body;
  if (!domain) {
    return NextResponse.json(
      { error: "domain is required" },
      { status: 400 }
    );
  }

  const cleanDomain = normalizeDomain(domain);

  const competitor = await prisma.competitor.create({
    data: {
      projectId: params.id,
      domain: cleanDomain,
      name: name || null,
    },
  });

  // Best-effort: pull tech, catalog and traffic estimate right away so the
  // Competencia tab shows something useful the moment it's added. Never
  // block adding the competitor if any of these fail.
  const data: Record<string, unknown> = {};

  try {
    const audit = await auditShopifyStore(cleanDomain);
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
  } catch {
    data.ecommerceIsShopify = false;
    data.ecommerceCheckedAt = new Date();
  }

  try {
    const tech = await detectTechnologies(cleanDomain);
    data.techDetectedJson = JSON.stringify(tech.detected);
  } catch {
    // ignore
  }

  try {
    const traffic = await fetchDomainTrafficOverview(
      cleanDomain,
      project.locationCode,
      project.languageCode
    );
    data.organicKeywords = traffic.organicKeywords;
    data.organicTrafficEstimate = traffic.organicTrafficEstimate;
    data.paidKeywords = traffic.paidKeywords;
    data.paidTrafficEstimate = traffic.paidTrafficEstimate;
    data.trafficValueEstimate = traffic.trafficValueEstimate;
    data.trafficCheckedAt = new Date();
  } catch {
    // ignore
  }

  try {
    const ranked = await fetchRankedKeywords(
      cleanDomain,
      project.locationCode,
      project.languageCode,
      20
    );
    data.rankedKeywordsJson = JSON.stringify(ranked);
  } catch {
    // ignore
  }

  const withInfo =
    Object.keys(data).length > 0
      ? await prisma.competitor.update({ where: { id: competitor.id }, data })
      : competitor;

  return NextResponse.json(withInfo, { status: 201 });
}
