import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

// Uptime monitor. Called every 10 min by a GitHub Actions workflow
// (.github/workflows/uptime.yml) hitting /api/cron/uptime. To avoid false
// alarms from a single blip, the "down" email only goes out after
// FAILS_BEFORE_ALERT consecutive failed checks; a recovery email follows
// when the site answers again.
const FAILS_BEFORE_ALERT = 2;
const CHECK_TIMEOUT_MS = 10_000;

export async function checkSite(domain: string): Promise<{ up: boolean; error: string | null }> {
  try {
    const res = await fetch(`https://${domain}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { "User-Agent": "ShopifyAudit-Uptime/1.0 (+https://shopifyaudit.com)" },
      cache: "no-store",
    });
    // 4xx (e.g. bot-blocking 403) still means the server is alive; only
    // 5xx and network-level failures count as down.
    if (res.status >= 500) return { up: false, error: `HTTP ${res.status}` };
    return { up: true, error: null };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return { up: false, error: `Sin respuesta en ${CHECK_TIMEOUT_MS / 1000}s` };
    }
    return { up: false, error: err instanceof Error ? err.message : "Error de conexion" };
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function emailShell(baseUrl: string, accent: string, title: string, bodyHtml: string, projectUrl: string) {
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

export async function runUptimeChecks(baseUrl: string) {
  const projects = await prisma.project.findMany({ where: { uptimeEnabled: true } });

  const results = await Promise.all(
    projects.map(async (project) => {
      const check = await checkSite(project.domain);
      const to = project.weeklyEmailTo || process.env.AUTH_EMAIL;
      const projectUrl = `${baseUrl}/projects/${project.id}`;
      const now = new Date();

      try {
        if (check.up) {
          if (project.uptimeStatus === "down") {
            const incident = await prisma.uptimeIncident.findFirst({
              where: { projectId: project.id, endedAt: null },
              orderBy: { startedAt: "desc" },
            });
            if (to) {
              const duration = incident ? fmtDuration(now.getTime() - incident.startedAt.getTime()) : null;
              await sendEmail({
                to,
                subject: `Tu sitio ${project.domain} volvio a estar en linea`,
                html: emailShell(
                  baseUrl,
                  "#155D34",
                  "Tu sitio ya responde de nuevo",
                  `<p style="margin:0 0 12px;font-size:14px;color:#374151;"><strong>${escapeHtml(project.domain)}</strong> volvio a estar en linea${
                    duration ? ` despues de aproximadamente <strong>${duration}</strong> de caida` : ""
                  }.</p>`,
                  projectUrl
                ),
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
          if (to) {
            await sendEmail({
              to,
              subject: `Tu sitio ${project.domain} esta caido`,
              html: emailShell(
                baseUrl,
                "#B91C1C",
                "Tu sitio no esta respondiendo",
                `<p style="margin:0 0 8px;font-size:14px;color:#374151;">No pudimos abrir <strong>${escapeHtml(project.domain)}</strong> en ${fails} revisiones seguidas (cada 10 min).</p>
                 <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">Motivo: ${escapeHtml(check.error ?? "desconocido")}</p>
                 <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">Te avisaremos cuando vuelva a estar en linea.</p>`,
                projectUrl
              ),
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

  return { checked: projects.length, results };
}
