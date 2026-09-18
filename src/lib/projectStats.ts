interface RankingLike {
  domain: string;
  position: number | null;
  checkedAt: Date | string;
}

interface KeywordLike {
  rankings: RankingLike[];
}

export interface ProjectStats {
  trackedKeywords: number;
  withPosition: number;
  avgPosition: number | null;
  top3: number;
  top10: number;
}

// Picks, for each keyword, the most recent ranking for the project's own
// domain and aggregates them into summary counters.
export function computeProjectStats(
  keywords: KeywordLike[],
  ownDomain: string
): ProjectStats {
  const latestPositions: number[] = [];

  for (const keyword of keywords) {
    let latest: RankingLike | null = null;
    for (const r of keyword.rankings) {
      if (r.domain !== ownDomain) continue;
      if (!latest || new Date(r.checkedAt) > new Date(latest.checkedAt)) {
        latest = r;
      }
    }
    if (latest?.position != null) {
      latestPositions.push(latest.position);
    }
  }

  const withPosition = latestPositions.length;
  const avgPosition =
    withPosition > 0
      ? latestPositions.reduce((a, b) => a + b, 0) / withPosition
      : null;

  return {
    trackedKeywords: keywords.length,
    withPosition,
    avgPosition,
    top3: latestPositions.filter((p) => p <= 3).length,
    top10: latestPositions.filter((p) => p <= 10).length,
  };
}

// Same aggregation as computeProjectStats, but as the numbers stood as of
// a past date — picks each keyword's latest ranking at or before `asOf`
// instead of the most recent one overall. Used to compute week-over-week
// deltas for the weekly email summary.
export function computeProjectStatsAsOf(
  keywords: KeywordLike[],
  ownDomain: string,
  asOf: Date
): ProjectStats {
  const latestPositions: number[] = [];

  for (const keyword of keywords) {
    let latest: RankingLike | null = null;
    for (const r of keyword.rankings) {
      if (r.domain !== ownDomain) continue;
      if (new Date(r.checkedAt) > asOf) continue;
      if (!latest || new Date(r.checkedAt) > new Date(latest.checkedAt)) {
        latest = r;
      }
    }
    if (latest?.position != null) {
      latestPositions.push(latest.position);
    }
  }

  const withPosition = latestPositions.length;
  const avgPosition =
    withPosition > 0
      ? latestPositions.reduce((a, b) => a + b, 0) / withPosition
      : null;

  return {
    trackedKeywords: keywords.length,
    withPosition,
    avgPosition,
    top3: latestPositions.filter((p) => p <= 3).length,
    top10: latestPositions.filter((p) => p <= 10).length,
  };
}
