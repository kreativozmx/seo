import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberByToken, getOwnedTask } from "@/lib/guestAuth";
import { parseDateInput, toTaskDTO } from "@/lib/tasks";
import { isTaskStatus } from "@/lib/taskStatus";

// Guests may change status and timeline of THEIR tasks — nothing else
// (no title/owner edits, no deleting).
export async function PATCH(req: NextRequest, { params }: { params: { token: string; taskId: string } }) {
  const member = await getMemberByToken(params.token);
  if (!member) return NextResponse.json({ error: "Enlace invalido" }, { status: 404 });
  const existing = await getOwnedTask(member.id, params.taskId);
  if (!existing) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

  const body = await req.json();
  const data: { status?: string; startDate?: Date | null; endDate?: Date | null } = {};
  if (body.status !== undefined) {
    if (!isTaskStatus(body.status)) return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
    data.status = body.status;
  }
  for (const key of ["startDate", "endDate"] as const) {
    if (body[key] !== undefined) {
      const parsed = parseDateInput(body[key]);
      if (parsed === undefined) return NextResponse.json({ error: "Fecha invalida" }, { status: 400 });
      data[key] = parsed;
    }
  }
  const start = data.startDate !== undefined ? data.startDate : existing.startDate;
  const end = data.endDate !== undefined ? data.endDate : existing.endDate;
  if (start && end && end < start) {
    return NextResponse.json({ error: "La fecha final no puede ser antes de la inicial" }, { status: 400 });
  }

  const task = await prisma.task.update({
    where: { id: existing.id },
    data,
    include: { _count: { select: { comments: true } } },
  });
  return NextResponse.json({ task: toTaskDTO(task) });
}
