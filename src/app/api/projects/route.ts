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
  return NextResponse.json(projects);
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
