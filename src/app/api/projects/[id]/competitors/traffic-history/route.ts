import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Returns, for each domain (own + competitors) tracked on this project, the
// most recent TrafficSnapshot at or before `?before=YYYY-MM-DD` — the
// closest thing we have to "what did this look like on that date". Snapshots
// only exist from whenever a domain was first analyzed/refreshed onward
// (see the snapshot writes in traffic-overview/refresh, competitors/route,
// and competitors/[id]/refresh), so a domain with no snapshot before that
// date is simply left out of the response.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const before = req.nextUrl.searchParams.get("before");
  if (!before) {
    return NextResponse.json({ error: "Falta el parametro before" }, { status: 400 });
  }
  const beforeDate = new Date(before);
  if (Number.isNaN(beforeDate.getTime())) {
    return NextResponse.json({ error: "Fecha invalida" }, { status: 400 });
  }

  const snapshots = await prisma.trafficSnapshot.findMany({
    where: { projectId: params.id, checkedAt: { lte: beforeDate } },
    orderBy: { checkedAt: "desc" },
  });

  const byDomain: Record<
    string,
    { organicKeywords: number | null; organicTrafficEstimate: number | null; trafficValueEstimate: number | null; checkedAt: string }
  > = {};
  for (const s of snapshots) {
    if (byDomain[s.domain]) continue; // already have the closest (most recent) one for this domain
    byDomain[s.domain] = {
      organicKeywords: s.organicKeywords,
      organicTrafficEstimate: s.organicTrafficEstimate,
      trafficValueEstimate: s.trafficValueEstimate,
      checkedAt: s.checkedAt.toISOString(),
    };
  }

  return NextResponse.json({ domains: byDomain });
}
