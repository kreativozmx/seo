import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { emailShell, escapeHtml } from "@/lib/emailTemplate";
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
      guestLink(params.baseUrl, await ensureAccessToken(member.id)),
      "Ver mis tareas →",
      "Recibes esto porque alguien te asigno una tarea en Shopify Audit. Este enlace es personal."
    ),
  });
}

export function newAccessToken() {
  return randomBytes(24).toString("hex");
}

export function guestLink(baseUrl: string, token: string) {
  return `${baseUrl}/tareas/${token}`;
}

// Returns the member's guest token, creating it if it doesn't exist yet.
export async function ensureAccessToken(memberId: string): Promise<string> {
  const member = await prisma.taskMember.findUniqueOrThrow({ where: { id: memberId } });
  if (member.accessToken) return member.accessToken;
  const token = newAccessToken();
  await prisma.taskMember.update({ where: { id: memberId }, data: { accessToken: token } });
  return token;
}

// Welcome email sent when someone is added to a project's people list.
export async function sendMemberInviteEmail(params: { memberId: string; baseUrl: string }) {
  const member = await prisma.taskMember.findUniqueOrThrow({
    where: { id: params.memberId },
    include: { project: { select: { name: true, domain: true } } },
  });
  const token = await ensureAccessToken(member.id);
  await sendEmail({
    to: member.email,
    subject: `Te invitaron al proyecto ${member.project.name}`,
    html: emailShell(
      params.baseUrl,
      "#111827",
      "Te invitaron a colaborar",
      `<p style="margin:0 0 12px;font-size:14px;color:#374151;">Hola ${escapeHtml(member.name)}, te sumaron al proyecto <strong>${escapeHtml(member.project.name)}</strong> (${escapeHtml(member.project.domain)}).</p>
       <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Con tu enlace personal puedes ver las tareas que te asignen, cambiar su estado, poner fechas y dejar comentarios. No necesitas crear una cuenta.</p>`,
      guestLink(params.baseUrl, token),
      "Abrir mis tareas →",
      "Este enlace es personal: no lo compartas con otras personas."
    ),
  });
}
