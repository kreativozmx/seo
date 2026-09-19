import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { computeProjectStats, computeProjectStatsAsOf } from "@/lib/projectStats";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import { fetchQueriesForRange, fetchPagesForRange } from "@/lib/providers/gsc";

export const WEEKLY_EMAIL_SECTIONS = ["positions", "traffic", "keywords", "pages"] as const;
export type WeeklyEmailSection = (typeof WEEKLY_EMAIL_SECTIONS)[number];

export const WEEKLY_EMAIL_SECTION_LABELS: Record<WeeklyEmailSection, string> = {
  positions: "Resumen de posiciones (Top 3 / Top 10 / cambios)",
  traffic: "Trafico (Search Console)",
  keywords: "Keywords principales",
  pages: "Paginas de destino principales",
};

export function parseWeeklyEmailSections(json: string | null): WeeklyEmailSection[] {
  if (!json) return [...WEEKLY_EMAIL_SECTIONS];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [...WEEKLY_EMAIL_SECTIONS];
    return parsed.filter((s): s is WeeklyEmailSection => WEEKLY_EMAIL_SECTIONS.includes(s));
  } catch {
    return [...WEEKLY_EMAIL_SECTIONS];
  }
}

interface KeywordMover {
  text: string;
  previousPosition: number | null;
  currentPosition: number | null;
  change: number | null; // negative = improved (moved up), positive = got worse
}

interface KeywordRow {
  query: string;
  position: number;
  previousPosition: number | null;
  clicks: number;
  impressions: number;
}

interface PageRow {
  page: string;
  clicks: number;
  previousClicks: number;
  change: number;
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

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function changeBadge(value: number | null, invert = false, decimals = 0): string {
  if (value == null || value === 0) return `<span style="color:#9ca3af;">sin cambio</span>`;
  const improved = invert ? value > 0 : value < 0;
  const color = improved ? "#155D34" : "#B91C1C";
  const arrow = improved ? "&#9650;" : "&#9660;";
  return `<span style="color:${color};font-weight:600;">${arrow} ${Math.abs(value).toFixed(decimals)}</span>`;
}

function sectionTable(headers: string[], rows: string[][]): string {
  const head = headers
    .map(
      (h, i) =>
        `<td style="padding:6px 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;${i > 0 ? "text-align:right;" : ""}">${h}</td>`
    )
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell, i) =>
              `<td style="padding:6px 8px;border-top:1px solid #e5e7eb;font-size:13px;${i > 0 ? "text-align:right;" : ""}color:#374151;">${cell}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>${head}</tr>
    ${body}
  </table>`;
}

interface EmailData {
  projectName: string;
  domain: string;
  projectUrl: string;
  homeUrl: string;
  logoUrl: string;
  dateRangeLabel: string;
  sections: WeeklyEmailSection[];
  stats: { avgPosition: number | null; top3: number; top10: number };
  prevStats: { avgPosition: number | null; top3: number; top10: number };
  movers: KeywordMover[];
  traffic: { clicksThisWeek: number; clicksLastWeek: number; impressionsThisWeek: number; impressionsLastWeek: number } | null;
  keywords: KeywordRow[];
  pages: PageRow[];
}

function buildEmailHtml(d: EmailData): string {
  const posDelta =
    d.stats.avgPosition != null && d.prevStats.avgPosition != null
      ? d.stats.avgPosition - d.prevStats.avgPosition
      : null;
  const top3Delta = d.stats.top3 - d.prevStats.top3;
  const top10Delta = d.stats.top10 - d.prevStats.top10;

  const trend =
    d.traffic == null
      ? null
      : d.traffic.clicksThisWeek > d.traffic.clicksLastWeek
      ? "ganando"
      : d.traffic.clicksThisWeek < d.traffic.clicksLastWeek
      ? "perdiendo"
      : null;
  const introLine = trend
    ? `Detectamos que tu dominio esta <strong>${trend} visibilidad</strong> en resultados de busqueda esta semana.`
    : `Aqui esta el resumen semanal de ${escapeHtml(d.domain)}.`;

  const positionsSection = d.sections.includes("positions")
    ? `<div style="margin-bottom:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:${
          d.movers.length > 0 ? "16px" : "0"
        };">
          <tr>
            <td width="33%" style="padding:10px 14px;background:#f9fafb;border-radius:8px 0 0 8px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;">Posicion prom.</p>
              <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#111827;">${d.stats.avgPosition != null ? d.stats.avgPosition.toFixed(1) : "—"}</p>
              <p style="margin:2px 0 0;font-size:12px;">${changeBadge(posDelta, true, 1)}</p>
            </td>
            <td width="33%" style="padding:10px 14px;background:#f3f4f6;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;">En Top 3</p>
              <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#111827;">${d.stats.top3}</p>
              <p style="margin:2px 0 0;font-size:12px;">${changeBadge(top3Delta)}</p>
            </td>
            <td width="34%" style="padding:10px 14px;background:#f9fafb;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;">En Top 10</p>
              <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#111827;">${d.stats.top10}</p>
              <p style="margin:2px 0 0;font-size:12px;">${changeBadge(top10Delta)}</p>
            </td>
          </tr>
        </table>
        ${
          d.movers.length > 0
            ? `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Mayor cambio de posicion esta semana</p>
        ${sectionTable(
          ["Keyword", "Antes", "Ahora", "Cambio"],
          d.movers.map((m) => [
            escapeHtml(m.text),
            m.previousPosition != null ? `#${m.previousPosition}` : "—",
            m.currentPosition != null ? `#${m.currentPosition}` : "—",
            m.change == null
              ? `<span style="color:#9ca3af;">nueva</span>`
              : changeBadge(m.change, true),
          ])
        )}`
            : ""
        }
      </div>`
    : "";

  const trafficSection =
    d.sections.includes("traffic") && d.traffic
      ? `<div style="margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Trafico (Search Console)</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding:10px 14px;background:#f9fafb;border-radius:8px 0 0 8px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;">Clics (7 dias)</p>
              <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#111827;">${d.traffic.clicksThisWeek.toLocaleString("es-MX")}</p>
              <p style="margin:2px 0 0;font-size:12px;">${changeBadge(d.traffic.clicksThisWeek - d.traffic.clicksLastWeek, true)} vs. semana pasada (${d.traffic.clicksLastWeek.toLocaleString("es-MX")})</p>
            </td>
            <td width="50%" style="padding:10px 14px;background:#f3f4f6;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase;">Impresiones (7 dias)</p>
              <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#111827;">${d.traffic.impressionsThisWeek.toLocaleString("es-MX")}</p>
              <p style="margin:2px 0 0;font-size:12px;">${changeBadge(d.traffic.impressionsThisWeek - d.traffic.impressionsLastWeek, true)} vs. semana pasada (${d.traffic.impressionsLastWeek.toLocaleString("es-MX")})</p>
            </td>
          </tr>
        </table>
      </div>`
      : "";

  const keywordsSection =
    d.sections.includes("keywords") && d.keywords.length > 0
      ? `<div style="margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Keywords principales</p>
        ${sectionTable(
          ["Keyword", "Posicion", "Cambio", "Clics", "Impr."],
          d.keywords.map((k) => [
            escapeHtml(k.query),
            `#${k.position.toFixed(0)}`,
            k.previousPosition == null
              ? `<span style="color:#9ca3af;">nueva</span>`
              : changeBadge(k.position - k.previousPosition, true),
            k.clicks.toLocaleString("es-MX"),
            k.impressions.toLocaleString("es-MX"),
          ])
        )}
      </div>`
      : "";

  const pagesSection =
    d.sections.includes("pages") && d.pages.length > 0
      ? `<div style="margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Paginas de destino principales</p>
        ${sectionTable(
          ["Pagina", "Clics", "Cambio"],
          d.pages.map((p) => [
            `<a href="${p.page}" style="color:#228449;text-decoration:none;">${escapeHtml(p.page.replace(/^https?:\/\//, ""))}</a>`,
            p.clicks.toLocaleString("es-MX"),
            changeBadge(p.change, true),
          ])
        )}
      </div>`
      : "";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#14171C;padding:14px 24px;">
                <a href="${d.homeUrl}" style="text-decoration:none;display:inline-flex;align-items:center;">
                  <img src="${d.logoUrl}" width="28" height="28" alt="" style="vertical-align:middle;border-radius:6px;display:inline-block;" />
                  <span style="color:#ffffff;font-size:15px;font-weight:600;vertical-align:middle;margin-left:8px;">Shopify Audit</span>
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 4px;font-size:18px;color:#111827;">Resumen semanal — ${escapeHtml(d.projectName)}</h1>
                <p style="margin:0 0 4px;font-size:13px;color:#6b7280;">${escapeHtml(d.domain)} · ${d.dateRangeLabel}</p>
                <p style="margin:0 0 20px;font-size:13px;color:#374151;">${introLine}</p>

                ${positionsSection}
                ${trafficSection}
                ${keywordsSection}
                ${pagesSection}

                <a href="${d.projectUrl}" style="display:inline-block;margin-top:4px;background:#228449;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:6px;">Ver dashboard completo →</a>
              </td>
            </tr>
          </table>
          <p style="font-size:11px;color:#9ca3af;margin-top:16px;">Recibes esto porque activaste el resumen semanal para este proyecto en <a href="${d.homeUrl}" style="color:#9ca3af;">Shopify Audit</a>. Elige que secciones recibir (o desactivalo) en la pestaña Notificaciones.</p>
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
// both produce the exact same email. Everything here comes from data we
// already have for free (our own Ranking history + the real Search
// Console API) — deliberately no DataForSEO calls, so this never spends
// API credits.
export async function sendWeeklyEmailForProject(project: ProjectWithKeywords, to: string, baseUrl: string) {
  const sections = parseWeeklyEmailSections(project.weeklyEmailSectionsJson);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const stats = computeProjectStats(project.keywords, project.domain);
  const prevStats = computeProjectStatsAsOf(project.keywords, project.domain, weekAgo);

  const movers: KeywordMover[] = sections.includes("positions")
    ? project.keywords
        .map((k) => {
          const current = ownLatestAt(k.rankings, project.domain, now);
          const previous = ownLatestAt(k.rankings, project.domain, weekAgo);
          const change = current != null && previous != null ? current - previous : null;
          return { text: k.text, previousPosition: previous, currentPosition: current, change };
        })
        .filter((m) => m.change != null && m.change !== 0)
        .sort((a, b) => Math.abs(b.change as number) - Math.abs(a.change as number))
        .slice(0, 8)
    : [];

  let traffic: EmailData["traffic"] = null;
  let keywords: KeywordRow[] = [];
  let pages: PageRow[] = [];
  let dateRangeLabel = "";

  const needsGsc = sections.includes("traffic") || sections.includes("keywords") || sections.includes("pages");
  if (needsGsc && project.gscRefreshToken && project.gscSiteUrl) {
    try {
      const client = oauthClientWithRefreshToken(project.gscRefreshToken);
      // GSC data lags ~2 days, so "this week" ends 2 days ago.
      const thisEnd = new Date(now);
      thisEnd.setDate(thisEnd.getDate() - 2);
      const thisStart = new Date(thisEnd);
      thisStart.setDate(thisStart.getDate() - 6);
      const lastEnd = new Date(thisStart);
      lastEnd.setDate(lastEnd.getDate() - 1);
      const lastStart = new Date(lastEnd);
      lastStart.setDate(lastStart.getDate() - 6);

      dateRangeLabel = `${thisStart.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} - ${thisEnd.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;

      const [thisQueries, lastQueries, thisPages, lastPages] = await Promise.all([
        fetchQueriesForRange(client, project.gscSiteUrl, fmtDate(thisStart), fmtDate(thisEnd)),
        fetchQueriesForRange(client, project.gscSiteUrl, fmtDate(lastStart), fmtDate(lastEnd)),
        fetchPagesForRange(client, project.gscSiteUrl, fmtDate(thisStart), fmtDate(thisEnd)),
        fetchPagesForRange(client, project.gscSiteUrl, fmtDate(lastStart), fmtDate(lastEnd)),
      ]);

      if (sections.includes("traffic")) {
        traffic = {
          clicksThisWeek: thisQueries.reduce((s, q) => s + q.clicks, 0),
          clicksLastWeek: lastQueries.reduce((s, q) => s + q.clicks, 0),
          impressionsThisWeek: thisQueries.reduce((s, q) => s + q.impressions, 0),
          impressionsLastWeek: lastQueries.reduce((s, q) => s + q.impressions, 0),
        };
      }

      if (sections.includes("keywords")) {
        const lastByQuery = new Map(lastQueries.map((q) => [q.query, q]));
        keywords = thisQueries.slice(0, 8).map((q) => ({
          query: q.query,
          position: q.position,
          previousPosition: lastByQuery.get(q.query)?.position ?? null,
          clicks: q.clicks,
          impressions: q.impressions,
        }));
      }

      if (sections.includes("pages")) {
        const lastByPage = new Map(lastPages.map((p) => [p.page, p]));
        pages = thisPages.slice(0, 8).map((p) => ({
          page: p.page,
          clicks: p.clicks,
          previousClicks: lastByPage.get(p.page)?.clicks ?? 0,
          change: p.clicks - (lastByPage.get(p.page)?.clicks ?? 0),
        }));
      }
    } catch {
      // GSC not reachable this run — email still sends with whatever
      // sections don't depend on it (e.g. positions from our own DB).
    }
  }

  const html = buildEmailHtml({
    projectName: project.name,
    domain: project.domain,
    projectUrl: `${baseUrl}/projects/${project.id}`,
    homeUrl: baseUrl,
    logoUrl: `${/localhost|127\.0\.0\.1/.test(baseUrl) ? "https://shopifyaudit.com" : baseUrl}/logo.png`,
    dateRangeLabel: dateRangeLabel || "ultimos 7 dias",
    sections,
    stats,
    prevStats,
    movers,
    traffic,
    keywords,
    pages,
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
  const project = await loadProjectForEmail(projectId);
  const to = project.weeklyEmailTo || process.env.AUTH_EMAIL;
  if (!to) {
    throw new Error("Agrega un correo destino (o configura AUTH_EMAIL en las variables de entorno).");
  }
  await sendWeeklyEmailForProject(project, to, baseUrl);
}

export async function runWeeklyEmailSummaries(baseUrl: string) {
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
      const to = project.weeklyEmailTo || process.env.AUTH_EMAIL;
      if (!to) throw new Error("Sin correo destino (agrega uno en Notificaciones o configura AUTH_EMAIL).");
      await sendWeeklyEmailForProject(project, to, baseUrl);
      sent++;
    } catch (err) {
      failed++;
      firstError = firstError ?? (err instanceof Error ? err.message : String(err));
    }
  }

  return { sent, failed, error: firstError };
}
