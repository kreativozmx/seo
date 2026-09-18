import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { computeProjectStats, computeProjectStatsAsOf } from "@/lib/projectStats";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import { fetchSiteHistory } from "@/lib/providers/gsc";

interface KeywordMover {
  text: string;
  previousPosition: number | null;
  currentPosition: number | null;
  change: number | null; // negative = improved (moved up), positive = got worse
}

function ownLatestAt(
  rankings: { domain: string; position: number | null; checkedAt: Date }[],
  ownDomain: string,
  asOf: Date
) {
  let latest: { position: number | null; checkedAt: Date } | null = null;
  for (const r of rankings) {
    if (r.domain !== ownDomain) continue;
    if (r.checkedAt > asOf) continue;
    if (!latest || r.checkedAt > latest.checkedAt) latest = r;
  }
  return latest?.position ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildEmailHtml(params: {
  projectName: string;
  domain: string;
  projectUrl: string;
  stats: { avgPosition: number | null; top3: number; top10: number; trackedKeywords: number };
  prevStats: { avgPosition: number | null; top3: number; top10: number };
  movers: KeywordMover[];
  gsc: { clicksThisWeek: number; clicksLastWeek: number; impressionsThisWeek: number } | null;
}): string {
  const { projectName, domain, projectUrl, stats, prevStats, movers, gsc } = params;

  const posDelta =
    stats.avgPosition != null && prevStats.avgPosition != null
      ? stats.avgPosition - prevStats.avgPosition
      : null;
  const top3Delta = stats.top3 - prevStats.top3;
  const top10Delta = stats.top10 - prevStats.top10;

  function deltaBadge(value: number | null, invert = false) {
    if (value == null || value === 0) return `<span style="color:#9ca3af;">sin cambio</span>`;
    const improved = invert ? value > 0 : value < 0;
    const color = improved ? "#155D34" : "#B91C1C";
    const arrow = improved ? "&#9650;" : "&#9660;";
    return `<span style="color:${color};font-weight:600;">${arrow} ${Math.abs(value).toFixed(1)}</span>`;
  }

  const moversRows = movers
    .map((m) => {
      const badge =
        m.change == null
          ? `<span style="color:#9ca3af;">nueva</span>`
          : m.change < 0
          ? `<span style="color:#155D34;font-weight:600;">&#9650; ${Math.abs(m.change)}</span>`
          : `<span style="color:#B91C1C;font-weight:600;">&#9660; ${Math.abs(m.change)}</span>`;
      return `<tr>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:13px;color:#374151;">${escapeHtml(m.text)}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:13px;text-align:right;color:#6b7280;">${m.previousPosition != null ? `#${m.previousPosition}` : "—"}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:13px;text-align:right;color:#374151;font-weight:600;">${m.currentPosition != null ? `#${m.currentPosition}` : "—"}</td>
        <td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:13px;text-align:right;">${badge}</td>
      </tr>`;
    })
    .join("");

  const gscBlock = gsc
    ? `<tr>
        <td style="padding:10px 14px;background:#f9fafb;border-radius:8px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;">Clics (7 dias)</p>
          <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#111827;">${gsc.clicksThisWeek.toLocaleString("es-MX")}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">semana anterior: ${gsc.clicksLastWeek.toLocaleString("es-MX")}</p>
        </td>
      </tr>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#14171C;padding:16px 24px;">
                <span style="color:#ffffff;font-size:15px;font-weight:600;">Shopify Audit</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 4px;font-size:18px;color:#111827;">Resumen semanal — ${escapeHtml(projectName)}</h1>
                <p style="margin:0 0 20px;font-size:13px;color:#6b7280;">${escapeHtml(domain)}</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                  <tr>
                    <td width="33%" style="padding:10px 14px;background:#f9fafb;border-radius:8px 0 0 8px;">
                      <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;">Posicion prom.</p>
                      <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#111827;">${stats.avgPosition != null ? stats.avgPosition.toFixed(1) : "—"}</p>
                      <p style="margin:2px 0 0;font-size:12px;">${deltaBadge(posDelta, true)}</p>
                    </td>
                    <td width="33%" style="padding:10px 14px;background:#f3f4f6;">
                      <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;">En Top 3</p>
                      <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#111827;">${stats.top3}</p>
                      <p style="margin:2px 0 0;font-size:12px;">${deltaBadge(top3Delta)}</p>
                    </td>
                    <td width="34%" style="padding:10px 14px;background:#f9fafb;border-radius:0 8px 8px 0;">
                      <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;">En Top 10</p>
                      <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#111827;">${stats.top10}</p>
                      <p style="margin:2px 0 0;font-size:12px;">${deltaBadge(top10Delta)}</p>
                    </td>
                  </tr>
                </table>

                ${gscBlock ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">${gscBlock}</table>` : ""}

                ${
                  movers.length > 0
                    ? `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Mayor cambio esta semana</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;">Keyword</td>
                    <td style="padding:6px 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;text-align:right;">Antes</td>
                    <td style="padding:6px 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;text-align:right;">Ahora</td>
                    <td style="padding:6px 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;text-align:right;">Cambio</td>
                  </tr>
                  ${moversRows}
                </table>`
                    : ""
                }

                <a href="${projectUrl}" style="display:inline-block;margin-top:24px;background:#228449;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:6px;">Ver dashboard completo →</a>
              </td>
            </tr>
          </table>
          <p style="font-size:11px;color:#9ca3af;margin-top:16px;">Recibes esto porque activaste el resumen semanal para este proyecto en Shopify Audit. Puedes desactivarlo en Ajustes.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

type ProjectWithKeywords = Awaited<ReturnType<typeof loadProjectForEmail>>;

function loadProjectForEmail(projectId: string) {
  return prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      keywords: {
        where: { archivedAt: null },
        include: { rankings: { orderBy: { checkedAt: "desc" }, take: 200 } },
      },
    },
  });
}

// Builds and sends the summary for one project, marking weeklyEmailLastSentAt.
// Shared by the bulk weekly run and the "send test email now" button, so
// both produce the exact same email.
export async function sendWeeklyEmailForProject(project: ProjectWithKeywords, to: string, baseUrl: string) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const stats = computeProjectStats(project.keywords, project.domain);
  const prevStats = computeProjectStatsAsOf(project.keywords, project.domain, weekAgo);

  const movers: KeywordMover[] = project.keywords
    .map((k) => {
      const current = ownLatestAt(k.rankings, project.domain, now);
      const previous = ownLatestAt(k.rankings, project.domain, weekAgo);
      const change = current != null && previous != null ? current - previous : null;
      return { text: k.text, previousPosition: previous, currentPosition: current, change };
    })
    .filter((m) => m.change != null && m.change !== 0)
    .sort((a, b) => Math.abs(b.change as number) - Math.abs(a.change as number))
    .slice(0, 8);

  let gsc: { clicksThisWeek: number; clicksLastWeek: number; impressionsThisWeek: number } | null = null;
  if (project.gscRefreshToken && project.gscSiteUrl) {
    try {
      const client = oauthClientWithRefreshToken(project.gscRefreshToken);
      const history = await fetchSiteHistory(client, project.gscSiteUrl, 14);
      const thisWeek = history.slice(-7);
      const lastWeek = history.slice(0, Math.max(0, history.length - 7));
      gsc = {
        clicksThisWeek: thisWeek.reduce((s, p) => s + p.clicks, 0),
        clicksLastWeek: lastWeek.reduce((s, p) => s + p.clicks, 0),
        impressionsThisWeek: thisWeek.reduce((s, p) => s + p.impressions, 0),
      };
    } catch {
      gsc = null;
    }
  }

  const html = buildEmailHtml({
    projectName: project.name,
    domain: project.domain,
    projectUrl: `${baseUrl}/projects/${project.id}`,
    stats,
    prevStats,
    movers,
    gsc,
  });

  await sendEmail({
    to,
    subject: `Resumen semanal de ${project.name} — pos. prom. ${stats.avgPosition != null ? stats.avgPosition.toFixed(1) : "—"}`,
    html,
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { weeklyEmailLastSentAt: new Date() },
  });
}

export async function sendWeeklyEmailTest(projectId: string, baseUrl: string) {
  const to = process.env.AUTH_EMAIL;
  if (!to) {
    throw new Error("Falta AUTH_EMAIL en las variables de entorno.");
  }
  const project = await loadProjectForEmail(projectId);
  await sendWeeklyEmailForProject(project, to, baseUrl);
}

export async function runWeeklyEmailSummaries(baseUrl: string) {
  const to = process.env.AUTH_EMAIL;
  if (!to) {
    return { sent: 0, failed: 0, error: "Falta AUTH_EMAIL en las variables de entorno." };
  }

  const projects = await prisma.project.findMany({
    where: { weeklyEmailEnabled: true },
    include: {
      keywords: {
        where: { archivedAt: null },
        include: { rankings: { orderBy: { checkedAt: "desc" }, take: 200 } },
      },
    },
  });

  let sent = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (const project of projects) {
    try {
      await sendWeeklyEmailForProject(project, to, baseUrl);
      sent++;
    } catch (err) {
      failed++;
      firstError = firstError ?? (err instanceof Error ? err.message : String(err));
    }
  }

  return { sent, failed, error: firstError };
}
