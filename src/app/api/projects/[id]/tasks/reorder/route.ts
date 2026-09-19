import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Persists a drag-and-drop reorder: `ids` is the full new order of the
// project's tasks; each one's position becomes its index.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (!Array.isArray(body.ids) || body.ids.some((i: unknown) => typeof i !== "string")) {
    return NextResponse.json({ error: "ids invalidos" }, { status: 400 });
  }
  const ids: string[] = body.ids;
  const owned = await prisma.task.findMany({
    where: { projectId: params.id, id: { in: ids } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((t) => t.id));
  await prisma.$transaction(
    ids
      .filter((id) => ownedIds.has(id))
      .map((id, index) => prisma.task.update({ where: { id }, data: { position: index } }))
  );
  return NextResponse.json({ ok: true });
}
