import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDateInput, sendTaskAssignedEmail, toTaskDTO } from "@/lib/tasks";
import { isTaskStatus } from "@/lib/taskStatus";

export async function PATCH(req: NextRequest, { params }: { params: { taskId: string } }) {
  const existing = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!existing) return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });

  const body = await req.json();
  const data: {
    title?: string;
    status?: string;
    ownerId?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
  } = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "El titulo es requerido" }, { status: 400 });
    data.title = title.slice(0, 300);
  }
  if (body.status !== undefined) {
    if (!isTaskStatus(body.status)) return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
    data.status = body.status;
  }
  if (body.ownerId !== undefined) {
    if (body.ownerId === null) {
      data.ownerId = null;
    } else {
      const member = await prisma.taskMember.findFirst({
        where: { id: String(body.ownerId), projectId: existing.projectId },
      });
      if (!member) return NextResponse.json({ error: "Persona no encontrada" }, { status: 400 });
      data.ownerId = member.id;
    }
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
    where: { id: params.taskId },
    data,
    include: { _count: { select: { comments: true } } },
  });

  // Notify the new owner (best-effort: a mail failure must not undo the assignment).
  let emailed: boolean | null = null;
  let emailError: string | null = null;
  if (data.ownerId && data.ownerId !== existing.ownerId) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
      await sendTaskAssignedEmail({
        projectId: task.projectId,
        taskId: task.id,
        memberId: data.ownerId,
        baseUrl,
      });
      emailed = true;
    } catch (err) {
      emailed = false;
      emailError = err instanceof Error ? err.message : "Error al enviar";
    }
  }
  return NextResponse.json({ task: toTaskDTO(task), emailed, emailError });
}

export async function DELETE(_req: NextRequest, { params }: { params: { taskId: string } }) {
  await prisma.task.deleteMany({ where: { id: params.taskId } });
  return NextResponse.json({ ok: true });
}
