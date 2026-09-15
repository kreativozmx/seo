import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Toggles one manual (non auto-detected) audit checklist item and persists
// it. itemId must match an id in AUDIT_ITEMS (src/lib/auditItems.ts) — no
// server-side validation of that beyond it being a non-empty string, since
// the list only ever changes from our own code.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const { itemId, checked } = body;
  if (typeof itemId !== "string" || !itemId || typeof checked !== "boolean") {
    return NextResponse.json(
      { error: "itemId (string) and checked (boolean) are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { auditManualChecksJson: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const current: Record<string, boolean> = project.auditManualChecksJson
    ? JSON.parse(project.auditManualChecksJson)
    : {};
  current[itemId] = checked;

  await prisma.project.update({
    where: { id: params.id },
    data: { auditManualChecksJson: JSON.stringify(current) },
  });

  return NextResponse.json({ ok: true });
}
