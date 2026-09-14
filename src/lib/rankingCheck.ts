import { prisma } from "@/lib/prisma";
import { fetchSerpSnapshot, analyzeSerpForDomain } from "@/lib/providers/dataforseo";

export async function checkKeywordNow(keywordId: string) {
  const keyword = await prisma.keyword.findUnique({
    where: { id: keywordId },
    include: { project: { include: { competitors: true } } },
  });

  if (!keyword) {
    throw new Error("Keyword not found");
  }

  if (keyword.engine !== "google" && keyword.engine !== "bing") {
    throw new Error(
      `El motor "${keyword.engine}" no tiene rastreo automatico configurado todavia.`
    );
  }

  const domains = [
    keyword.project.domain,
    ...keyword.project.competitors.map((c) => c.domain),
  ];

  // One SERP fetch covers every domain we care about for this keyword.
  const snapshot = await fetchSerpSnapshot({
    keyword: keyword.text,
    engine: keyword.engine as "google" | "bing",
    locationCode: keyword.project.locationCode,
    languageCode: keyword.project.languageCode,
    device: keyword.device as "desktop" | "mobile",
  });

  const rankings = [];
  for (const domain of domains) {
    const result = analyzeSerpForDomain(snapshot, domain);
    const isOwnDomain = domain === keyword.project.domain;

    const ranking = await prisma.ranking.create({
      data: {
        keywordId: keyword.id,
        domain,
        position: result.position,
        url: result.url,
        source: "dataforseo",
        aiMentioned: result.aiOverviewMentioned,
        aiOverviewText: result.aiOverviewText,
        aiCitedDomainsJson:
          result.aiCitedDomains.length > 0
            ? JSON.stringify(result.aiCitedDomains)
            : null,
        // Only stored on the project's own row — every domain's snapshot
        // would be identical anyway, no need to duplicate it per domain.
        topResultsJson: isOwnDomain ? JSON.stringify(result.topOrganicResults) : null,
      },
    });
    rankings.push(ranking);
  }

  return rankings;
}
