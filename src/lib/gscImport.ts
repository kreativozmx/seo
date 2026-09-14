import { Project } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import { fetchQueryHistory, fetchSiteSummary } from "@/lib/providers/gsc";

export interface GscImportResult {
  keywords: number;
  keywordsCreated: number;
  rankingsImported: number;
}

// Pulls the last 90 days of daily history for the top queries by
// impressions, in a single API call, and backfills real past dates instead
// of a single "now" snapshot. Shared by the manual "Importar desde GSC"
// button and the daily cron job.
export async function importGscHistory(
  project: Project
): Promise<GscImportResult> {
  if (!project.gscRefreshToken || !project.gscSiteUrl) {
    throw new Error("Este proyecto no tiene Search Console conectado");
  }

  const client = oauthClientWithRefreshToken(project.gscRefreshToken);
  const rows = await fetchQueryHistory(client, project.gscSiteUrl, 90, 30);

  const keywordIdByText = new Map<string, string>();
  let keywordsCreated = 0;
  let rankingsImported = 0;

  for (const row of rows) {
    if (!row.query || row.position <= 0 || !row.date) continue;

    let keywordId = keywordIdByText.get(row.query);
    if (!keywordId) {
      let keyword = await prisma.keyword.findFirst({
        where: { projectId: project.id, text: row.query, engine: "google" },
      });
      if (!keyword) {
        keyword = await prisma.keyword.create({
          data: {
            projectId: project.id,
            text: row.query,
            engine: "google",
            device: "desktop",
            source: "gsc",
          },
        });
        keywordsCreated++;
      }
      keywordId = keyword.id;
      keywordIdByText.set(row.query, keywordId);
    }

    const checkedAt = new Date(`${row.date}T00:00:00.000Z`);

    await prisma.ranking.upsert({
      where: {
        keywordId_domain_checkedAt_source: {
          keywordId,
          domain: project.domain,
          checkedAt,
          source: "gsc",
        },
      },
      create: {
        keywordId,
        domain: project.domain,
        position: Math.round(row.position),
        source: "gsc",
        checkedAt,
      },
      update: {
        position: Math.round(row.position),
      },
    });
    rankingsImported++;
  }

  return {
    keywords: keywordIdByText.size,
    keywordsCreated,
    rankingsImported,
  };
}

export async function refreshGscStats(project: Project) {
  if (!project.gscRefreshToken || !project.gscSiteUrl) {
    throw new Error("Este proyecto no tiene Search Console conectado");
  }

  const client = oauthClientWithRefreshToken(project.gscRefreshToken);
  const summary = await fetchSiteSummary(client, project.gscSiteUrl, 28);

  return prisma.project.update({
    where: { id: project.id },
    data: {
      gscClicks28d: summary.clicks,
      gscImpressions28d: summary.impressions,
      gscAvgPosition28d: summary.avgPosition,
      gscStatsUpdatedAt: new Date(),
    },
  });
}
