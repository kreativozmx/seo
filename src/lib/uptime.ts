import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// Uptime monitor. Called every 10 min by a GitHub Actions workflow
// (.github/workflows/uptime.yml) hitting /api/cron/uptime. To avoid false
// alarms from a single blip, the "down" email only goes out after
// FAILS_BEFORE_ALERT consecutive failed checks; a recovery email follows
// when the site answers again.
const FAILS_BEFORE_ALERT = 2;
const CHECK_TIMEOUT_MS = 10_000;

export interface SiteCheck {
  up: boolean;
  error: string | null;
  responseMs: number | null;
}

// Who gets uptime alerts: the report recipient (unless turned off) plus any
// extra addresses the user added for this project.
export function uptimeRecipients(project: {
  weeklyEmailTo: string | null;
  uptimeEmailsJson: string | null;
  uptimeUseReportEmail: boolean;
}): string[] {
  const list: string[] = [];
  if (project.uptimeUseReportEmail) {
    const base = project.weeklyEmailTo || process.env.AUTH_EMAIL;
    if (base) list.push(base);
  }
  try {
    const extra = project.uptimeEmailsJson ? JSON.parse(project.uptimeEmailsJson) : [];
    if (Array.isArray(extra)) for (const e of extra) if (typeof e === "string") list.push(e);
  } catch {
    // ignore malformed JSON
  }
  return Array.from(new Set(list.map((e) => e.trim().toLowerCase()))).filter(Boolean);
}

export async function checkSite(domain: string): Promise<SiteCheck> {
  const startedAt = Date.now();
  try {
    const res = await fetch(`https://${domain}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { "User-Agent": "ShopifyAudit-Uptime/1.0 (+https://shopifyaudit.com)" },
      cache: "no-store",
    });
    // 4xx (e.g. bot-blocking 403) still means the server is alive; only
    // 5xx and network-level failures count as down.
    const responseMs = Date.now() - startedAt;
    if (res.status >= 500) return { up: false, error: `HTTP ${res.status}`, responseMs };
    return { up: true, error: null, responseMs };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return { up: false, error: `Sin respuesta en ${CHECK_TIMEOUT_MS / 1000}s`, responseMs: null };
    }
    return { up: false, error: err instanceof Error ? err.message : "Error de conexion", responseMs: null };
  }
}

// Emails are opened on the recipient's machine, so localhost URLs (dev/test
// sends) would break the logo image and links — fall back to the public site.
function publicUrl(baseUrl: string) {
  return /localhost|127\.0\.0\.1/.test(baseUrl) ? "https://shopifyaudit.com" : baseUrl;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function emailShell(rawBaseUrl: string, accent: string, title: string, bodyHtml: string, projectUrl: string) {
  const baseUrl = publicUrl(rawBaseUrl);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#14171C;padding:14px 24px;">
          <a href="${baseUrl}" style="text-decoration:none;">
            <img src="${baseUrl}/logo.png" width="28" height="28" alt="" style="vertical-align:middle;border-radius:6px;" />
            <span style="color:#ffffff;font-size:15px;font-weight:600;vertical-align:middle;margin-left:8px;">Shopify Audit</span>
          </a>
        </td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:${accent};">${title}</h1>
          ${bodyHtml}
          <a href="${projectUrl}" style="display:inline-block;margin-top:8px;background:#228449;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:6px;">Ver monitoreo →</a>
        </td></tr>
      </table>
      <p style="font-size:11px;color:#9ca3af;margin-top:16px;">Recibes esto porque activaste el monitoreo de disponibilidad de este proyecto en Shopify Audit.</p>
    </td></tr>
  </table>
</body></html>`;
}

function fmtDuration(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

function testBanner(isTest: boolean) {
  return isTest
    ? `<p style="margin:0 0 16px;padding:8px 12px;background:#FEF3C7;border-radius:6px;font-size:12px;color:#92400E;">Este es un correo de <strong>prueba</strong> para que veas como te llegara. Tu sitio esta funcionando con normalidad.</p>`
    : "";
}

function buildDownEmail(baseUrl: string, domain: string, fails: number, error: string | null, projectUrl: string, isTest = false) {
  return emailShell(
    baseUrl,
    "#B91C1C",
    "Tu sitio no esta respondiendo",
    `${testBanner(isTest)}<p style="margin:0 0 8px;font-size:14px;color:#374151;">No pudimos abrir <strong>${escapeHtml(domain)}</strong> en ${fails} revisiones seguidas (cada 10 min).</p>
     <p style="margin:0 0 16px;font-size:13px;color:#6b7280;">Motivo tecnico: ${escapeHtml(error ?? "desconocido")}</p>
     <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#374151;">Posibles razones</p>
     <ul style="margin:0 0 16px;padding-left:18px;font-size:13px;line-height:1.6;color:#4b5563;">
       <li><strong>Falla o mantenimiento de Shopify:</strong> revisa el estado de la plataforma con los botones de abajo.</li>
       <li><strong>Una actualizacion reciente:</strong> un cambio de tema, una app instalada o actualizada, o una actualizacion de Shopify puede romper la tienda.</li>
       <li><strong>Dominio o SSL:</strong> dominio vencido, DNS mal configurado o certificado SSL con problemas.</li>
       <li><strong>Tienda pausada o plan vencido</strong>, o un pico de trafico inesperado.</li>
     </ul>
     <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Verifica si el problema es de Shopify en general:</p>
     <p style="margin:0 0 16px;">
       <a href="https://www.shopifystatus.com/" style="display:inline-block;margin:0 8px 8px 0;background:#ffffff;color:#14171C;border:1px solid #d1d5db;text-decoration:none;font-size:13px;font-weight:600;padding:9px 16px;border-radius:6px;">Estado de Shopify</a>
       <a href="https://downdetector.mx/en/status/shopify/" style="display:inline-block;margin:0 8px 8px 0;background:#ffffff;color:#14171C;border:1px solid #d1d5db;text-decoration:none;font-size:13px;font-weight:600;padding:9px 16px;border-radius:6px;">Downdetector (reportes de usuarios)</a>
     </p>
     <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">Te avisaremos cuando tu sitio vuelva a estar en linea.</p>`,
    projectUrl
  );
}

function buildRecoveryEmail(baseUrl: string, domain: string, duration: string | null, projectUrl: string, isTest = false) {
  return emailShell(
    baseUrl,
    "#155D34",
    "Tu sitio ya responde de nuevo",
    `${testBanner(isTest)}<p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>${escapeHtml(domain)}</strong> volvio a estar en linea${
      duration ? ` despues de aproximadamente <strong>${duration}</strong> de caida` : ""
    }.</p>`,
    projectUrl
  );
}

// Sends both alert emails with sample data so the user can see exactly what
// they'll receive, without touching any real monitoring state.
export async function sendUptimeTestEmails(projectId: string, baseUrl: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const to = uptimeRecipients(project);
  if (to.length === 0) throw new Error("Agrega al menos un correo destino para las alertas de caida.");
  const projectUrl = `${baseUrl}/projects/${project.id}`;
  await sendEmail({
    to,
    subject: `[Prueba] Tu sitio ${project.domain} esta caido`,
    html: buildDownEmail(baseUrl, project.domain, 2, "HTTP 503", projectUrl, true),
  });
  await sendEmail({
    to,
    subject: `[Prueba] Tu sitio ${project.domain} volvio a estar en linea`,
    html: buildRecoveryEmail(baseUrl, project.domain, "14 min", projectUrl, true),
  });
  return to.join(", ");
}

export async function runUptimeChecks(baseUrl: string) {
  // Every project is checked and recorded (feeds the availability chart);
  // only projects with alerts turned on (uptimeEnabled) get emails.
  const projects = await prisma.project.findMany();

  const results = await Promise.all(
    projects.map(async (project) => {
      const check = await checkSite(project.domain);
      const to = uptimeRecipients(project);
      const projectUrl = `${baseUrl}/projects/${project.id}`;
      const now = new Date();

      try {
        await prisma.uptimeCheck.create({
          data: { projectId: project.id, up: check.up, responseMs: check.responseMs, error: check.error },
        });
        if (check.up) {
          if (project.uptimeStatus === "down") {
            const incident = await prisma.uptimeIncident.findFirst({
              where: { projectId: project.id, endedAt: null },
              orderBy: { startedAt: "desc" },
            });
            if (project.uptimeEnabled && to.length > 0) {
              const duration = incident ? fmtDuration(now.getTime() - incident.startedAt.getTime()) : null;
              await sendEmail({
                to,
                subject: `Tu sitio ${project.domain} volvio a estar en linea`,
                html: buildRecoveryEmail(baseUrl, project.domain, duration, projectUrl),
              });
            }
            if (incident) {
              await prisma.uptimeIncident.update({ where: { id: incident.id }, data: { endedAt: now } });
            }
          }
          await prisma.project.update({
            where: { id: project.id },
            data: { uptimeStatus: "up", uptimeFailCount: 0, uptimeLastCheckedAt: now },
          });
          return "up";
        }

        const fails = project.uptimeFailCount + 1;
        if (fails >= FAILS_BEFORE_ALERT && project.uptimeStatus !== "down") {
          // Email first: if it fails we leave state untouched so the next run retries the alert.
          if (project.uptimeEnabled && to.length > 0) {
            await sendEmail({
              to,
              subject: `Tu sitio ${project.domain} esta caido`,
              html: buildDownEmail(baseUrl, project.domain, fails, check.error, projectUrl),
            });
          }
          await prisma.uptimeIncident.create({ data: { projectId: project.id, lastError: check.error } });
          await prisma.project.update({
            where: { id: project.id },
            data: { uptimeStatus: "down", uptimeFailCount: fails, uptimeLastCheckedAt: now },
          });
          return "down-alerted";
        }

        await prisma.project.update({
          where: { id: project.id },
          data: { uptimeFailCount: fails, uptimeLastCheckedAt: now },
        });
        return project.uptimeStatus === "down" ? "down" : "failing";
      } catch (err) {
        return `error: ${err instanceof Error ? err.message : String(err)}`;
      }
    })
  );

  // Keep the history table small: the chart only shows up to 30 days.
  await prisma.uptimeCheck.deleteMany({ where: { checkedAt: { lt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) } } });

  return { checked: projects.length, results };
}
