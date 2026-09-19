import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchDomainAuthority } from "@/lib/providers/openPageRank";

export const maxDuration = 30;

// One batched Open PageRank call for the project's domain + all competitors.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { competitors: { select: { domain: true } } },
  });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  try {
    const domains = [project.domain, ...project.competitors.map((c) => c.domain)];
    const authority = await fetchDomainAuthority(domains);
    await prisma.project.update({
      where: { id: project.id },
      data: { authorityJson: JSON.stringify(authority), authorityUpdatedAt: new Date() },
    });
    return NextResponse.json({ authority });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error" }, { status: 400 });
  }
}
