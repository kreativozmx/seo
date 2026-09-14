import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain } from "@/lib/domain";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      competitors: true,
      keywords: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        include: {
          rankings: {
            orderBy: { checkedAt: "desc" },
            take: 30,
          },
        },
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { name, domain, locationCode, languageCode } = body;
  const project = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(name ? { name } : {}),
      ...(domain ? { domain: normalizeDomain(domain) } : {}),
      ...(locationCode ? { locationCode } : {}),
      ...(languageCode ? { languageCode } : {}),
    },
  });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
