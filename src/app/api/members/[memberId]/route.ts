import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Tasks owned by this person become unassigned (onDelete: SetNull).
export async function DELETE(_req: NextRequest, { params }: { params: { memberId: string } }) {
  await prisma.taskMember.deleteMany({ where: { id: params.memberId } });
  return NextResponse.json({ ok: true });
}
