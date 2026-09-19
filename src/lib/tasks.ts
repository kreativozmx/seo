import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { emailShell, escapeHtml, publicUrl } from "@/lib/emailTemplate";
import { TASK_STATUSES } from "@/lib/taskStatus";

const STATUS_LABELS_ES: Record<string, string> = {
  working: "Trabajando en ello",
  done: "Listo",
  blocked: "Interrumpido",
  planned: "Planificado",
  review: "Listo para revision",
  waiting: "En espera",
  material: "Material pendiente",
};

export interface TaskDTO {
  id: string;
  title: string;
  status: string;
  ownerId: string | null;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  position: number;
  commentCount: number;
}

const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function toTaskDTO(t: {
  id: string;
  title: string;
  status: string;
  ownerId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  position: number;
  _count?: { comments: number };
}): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    ownerId: t.ownerId,
    startDate: dateOnly(t.startDate),
    endDate: dateOnly(t.endDate),
    position: t.position,
    commentCount: t._count?.comments ?? 0,
  };
}

// Parses "YYYY-MM-DD" (or null/"" to clear). Returns undefined when invalid.
export function parseDateInput(value: unknown): Date | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// Emails a person when a task is assigned to them (they don't log into the
// app, so this is how external members find out).
export async function sendTaskAssignedEmail(params: {
  projectId: string;
  taskId: string;
  memberId: string;
  baseUrl: string;
}) {
  const [task, member, project] = await Promise.all([
    prisma.task.findUniqueOrThrow({ where: { id: params.taskId } }),
    prisma.taskMember.findUniqueOrThrow({ where: { id: params.memberId } }),
    prisma.project.findUniqueOrThrow({ where: { id: params.projectId }, select: { name: true, domain: true } }),
  ]);
  const status = TASK_STATUSES.find((s) => s.id === task.status);
  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }) : null;
  const range =
    task.startDate || task.endDate ? [fmt(task.startDate), fmt(task.endDate)].filter(Boolean).join(" – ") : null;

  const body = `<p style="margin:0 0 12px;font-size:14px;color:#374151;">Hola ${escapeHtml(member.name)}, te asignaron una tarea en el proyecto <strong>${escapeHtml(project.name)}</strong> (${escapeHtml(project.domain)}):</p>
    <div style="margin:0 0 16px;padding:12px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
      <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111827;">${escapeHtml(task.title)}</p>
      <p style="margin:0;font-size:12px;color:#6b7280;">
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${status?.bg ?? "#579bfc"};color:${status?.fg ?? "#fff"};font-weight:600;">${escapeHtml(STATUS_LABELS_ES[task.status] ?? task.status)}</span>
        ${range ? `&nbsp; Cronograma: ${escapeHtml(range)}` : ""}
      </p>
    </div>`;

  await sendEmail({
    to: member.email,
    subject: `Nueva tarea asignada: ${task.title}`,
    html: emailShell(
      params.baseUrl,
      "#111827",
      "Tienes una nueva tarea",
      body,
      publicUrl(params.baseUrl),
      "Abrir Shopify Audit →",
      "Recibes esto porque alguien te asigno una tarea en Shopify Audit."
    ),
  });
}
