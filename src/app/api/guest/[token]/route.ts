import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMemberByToken } from "@/lib/guestAuth";
import { toTaskDTO } from "@/lib/tasks";

// Public (guest link): only the tasks assigned to this person.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const member = await getMemberByToken(params.token);
  if (!member) return NextResponse.json({ error: "Enlace invalido" }, { status: 404 });
  const tasks = await prisma.task.findMany({
    where: { ownerId: member.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { comments: true } } },
  });
  return NextResponse.json({
    member: { name: member.name },
    project: { name: member.project.name, domain: member.project.domain },
    tasks: tasks.map(toTaskDTO),
  });
}
