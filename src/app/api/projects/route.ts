import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain } from "@/lib/domain";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { keywords: true, competitors: true } },
    },
  });
  // Never send OAuth refresh tokens or the share link secret to the client.
  const sanitized = projects.map((p) => {
    const copy: Partial<typeof p> = { ...p };
    delete copy.gscRefreshToken;
    delete copy.gaRefreshToken;
    delete copy.gbpRefreshToken;
    delete copy.shopifyAccessToken;
    delete copy.shareToken;
    return copy;
  });
  return NextResponse.json(sanitized);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, domain, locationCode, languageCode } = body;
  if (!name || !domain) {
    return NextResponse.json(
      { error: "name and domain are required" },
      { status: 400 }
    );
  }
  const project = await prisma.project.create({
    data: {
      name,
      domain: normalizeDomain(domain),
      ...(locationCode ? { locationCode } : {}),
      ...(languageCode ? { languageCode } : {}),
    },
  });
  return NextResponse.json(project, { status: 201 });
}
