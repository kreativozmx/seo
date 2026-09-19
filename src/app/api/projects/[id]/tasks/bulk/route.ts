import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_BULK = 100;

// "Add to my tasks" from anywhere in the app (audit items, competitor
// tasks, broken links...). Creates one task per item, skipping titles that
// already exist in the project (so re-adding is harmless), and stores the
// item's context as the first message of the task's conversation.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });

  const body = await req.json();
  const input: { title?: unknown; note?: unknown }[] = Array.isArray(body.tasks) ? body.tasks.slice(0, MAX_BULK) : [];
  if (input.length === 0) return NextResponse.json({ error: "No hay tareas para agregar" }, { status: 400 });

  const existing = await prisma.task.findMany({ where: { projectId: project.id }, select: { title: true, position: true } });
  const known = new Set(existing.map((t) => t.title.trim().toLowerCase()));
  let position = existing.reduce((m, t) => Math.max(m, t.position), -1);

  const created: { id: string; title: string }[] = [];
  const skipped: string[] = [];

  for (const item of input) {
    const title = typeof item.title === "string" ? item.title.trim().slice(0, 300) : "";
    if (!title) continue;
    const key = title.toLowerCase();
    if (known.has(key)) {
      skipped.push(title);
      continue;
    }
    known.add(key);
    position += 1;
    const note = typeof item.note === "string" ? item.note.trim().slice(0, 5000) : "";
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        title,
        position,
        ...(note ? { comments: { create: { authorName: "Shopify Audit", body: note } } } : {}),
      },
      select: { id: true, title: true },
    });
    created.push(task);
  }

  return NextResponse.json({ created, skipped });
}
