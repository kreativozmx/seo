import { prisma } from "@/lib/prisma";
import { checkKeywordNow } from "@/lib/rankingCheck";
import { importGscHistory, refreshGscStats } from "@/lib/gscImport";

// Runs one full daily pass: checks every Google/Bing keyword across every
// project (DataForSEO), and refreshes GSC history + stats for projects
// that have Search Console connected. Used by both the cron schedule and
// the manual "Rastrear ahora" trigger.
export async function runDailyRankChecks() {
  const run = await prisma.cronRun.create({ data: {} });

  let keywordsOk = 0;
  let keywordsFailed = 0;
  let gscProjectsOk = 0;
  let topError: string | null = null;

  try {
    const keywords = await prisma.keyword.findMany({
      where: { archivedAt: null, engine: { in: ["google", "bing"] } },
      select: { id: true },
    });

    for (const keyword of keywords) {
      try {
        await checkKeywordNow(keyword.id);
        keywordsOk++;
      } catch (err) {
        keywordsFailed++;
        topError = topError ?? (err instanceof Error ? err.message : String(err));
      }
    }

    const gscProjects = await prisma.project.findMany({
      where: { gscRefreshToken: { not: null }, gscSiteUrl: { not: null } },
    });

    for (const project of gscProjects) {
      try {
        await importGscHistory(project);
        await refreshGscStats(project);
        gscProjectsOk++;
      } catch (err) {
        topError = topError ?? (err instanceof Error ? err.message : String(err));
      }
    }
  } catch (err) {
    topError = err instanceof Error ? err.message : String(err);
  }

  await prisma.cronRun.update({
    where: { id: run.id },
    data: {
      finishedAt: new Date(),
      keywordsOk,
      keywordsFailed,
      gscProjectsOk,
      error: topError,
    },
  });

  return { keywordsOk, keywordsFailed, gscProjectsOk, error: topError };
}
