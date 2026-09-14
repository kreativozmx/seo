import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain } from "@/lib/domain";
import { detectShopifyBasic } from "@/lib/providers/shopify";
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
    const info = await detectShopifyBasic(cleanDomain);
    data.ecommerceIsShopify = info.isShopify;
    data.ecommerceProductCount = info.productCount;
    data.ecommerceCollectionCount = info.collectionCount;
    data.ecommerceCheckedAt = new Date();
  } catch {
    // ignore
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
