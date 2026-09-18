import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { oauthClientWithRefreshToken } from "@/lib/googleAuth";
import {
  fetchGa4Summary,
  fetchGa4ChannelBreakdown,
  fetchGa4Analytics,
  fetchGa4AiTraffic,
  fetchGa4PageBehavior,
} from "@/lib/providers/ga4";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  if (!project.gaRefreshToken) {
    return NextResponse.json(
      { error: "Este proyecto no tiene Google Analytics conectado" },
      { status: 400 }
    );
  }
  if (!project.gaPropertyId) {
    return NextResponse.json(
      { error: "Falta indicar el Property ID de GA4" },
      { status: 400 }
    );
  }

  try {
    const client = oauthClientWithRefreshToken(project.gaRefreshToken);
    const [summary, channels, analytics, aiTraffic] = await Promise.all([
      fetchGa4Summary(client, project.gaPropertyId, 28),
      fetchGa4ChannelBreakdown(client, project.gaPropertyId, 28),
      fetchGa4Analytics(client, project.gaPropertyId, 28),
      fetchGa4AiTraffic(client, project.gaPropertyId, 28),
    ]);

    // Kept as its own try/catch: it's a nice-to-have proxy for a heatmap,
    // not core traffic/revenue data, so a hiccup here shouldn't fail the
    // whole refresh.
    let behavior: Awaited<ReturnType<typeof fetchGa4PageBehavior>> | null = null;
    try {
      behavior = await fetchGa4PageBehavior(client, project.gaPropertyId, project.domain, 28);
    } catch {
      // leave behavior null — the Analiticas tab just shows the last cached values (if any)
    }

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        gaSessions28d: summary.sessions,
        gaUsers28d: summary.users,
        gaConversions28d: summary.conversions,
        gaStatsUpdatedAt: new Date(),
        gaSessionsOrganic28d: channels.organic,
        gaSessionsPaid28d: channels.paid,
        gaSessionsDirect28d: channels.direct,
        gaSessionsReferral28d: channels.referral,
        gaSessionsAi28d: channels.ai,
        gaChannelsUpdatedAt: new Date(),
        gaRevenue28d: analytics.revenue,
        gaTransactions28d: analytics.transactions,
        gaAvgOrderValue28d: analytics.avgOrderValue,
        gaNewUsers28d: analytics.newUsers,
        gaEngagementRate28d: analytics.engagementRate,
        gaAvgSessionSec28d: Math.round(analytics.avgSessionDurationSec),
        gaTopPagesJson: JSON.stringify(analytics.topPages),
        gaTopCountriesJson: JSON.stringify(analytics.topCountries),
        gaDeviceBreakdownJson: JSON.stringify(analytics.deviceBreakdown),
        gaTopCampaignsJson: JSON.stringify(analytics.topCampaigns),
        gaTopSourcesJson: JSON.stringify(analytics.topSources),
        gaTopMediumsJson: JSON.stringify(analytics.topMediums),
        gaSalesByChannelJson: JSON.stringify(analytics.salesByChannel),
        gaSalesBySourceJson: JSON.stringify(analytics.salesBySource),
        gaSalesByMediumJson: JSON.stringify(analytics.salesByMedium),
        gaSalesByLandingPageJson: JSON.stringify(analytics.salesByLandingPage),
        gaSalesByDeviceJson: JSON.stringify(analytics.salesByDevice),
        gaOrdersByDateJson: JSON.stringify(analytics.ordersByDate),
        gaTopProductsJson: JSON.stringify(analytics.topProducts),
        gaTopAddToCartProductsJson: JSON.stringify(analytics.topAddToCartProducts),
        gaAnalyticsUpdatedAt: new Date(),
        gaAiTrafficSessions28d: aiTraffic.totalSessions,
        gaAiTrafficBySourceJson: JSON.stringify(aiTraffic.bySource),
        gaAiLandingPagesJson: JSON.stringify(aiTraffic.landingPages),
        ...(behavior && {
          gaScrollByPageJson: JSON.stringify(behavior.scrollByPage),
          gaEngagementByPageJson: JSON.stringify(behavior.engagementByPage),
          gaInternalReferrersJson: JSON.stringify(behavior.internalReferrers),
          gaBehaviorUpdatedAt: new Date(),
        }),
      },
    });

    return NextResponse.json({
      gaSessions28d: updated.gaSessions28d,
      gaUsers28d: updated.gaUsers28d,
      gaConversions28d: updated.gaConversions28d,
      gaStatsUpdatedAt: updated.gaStatsUpdatedAt,
      gaSessionsOrganic28d: updated.gaSessionsOrganic28d,
      gaSessionsPaid28d: updated.gaSessionsPaid28d,
      gaSessionsDirect28d: updated.gaSessionsDirect28d,
      gaSessionsReferral28d: updated.gaSessionsReferral28d,
      gaSessionsAi28d: updated.gaSessionsAi28d,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
