import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { uptimeEnabled: true, uptimeStatus: true, uptimeLastCheckedAt: true },
  });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  const incidents = await prisma.uptimeIncident.findMany({
    where: { projectId: params.id },
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ ...project, incidents });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled requerido" }, { status: 400 });
  }
  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      uptimeEnabled: body.enabled,
      // Fresh start whenever it's toggled so stale state can't trigger a bogus alert.
      uptimeStatus: null,
      uptimeFailCount: 0,
    },
  });
  return NextResponse.json({ uptimeEnabled: updated.uptimeEnabled });
}
