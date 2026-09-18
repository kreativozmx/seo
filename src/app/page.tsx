import Link from "next/link";
import { prisma } from "@/lib/prisma";
import NewProjectForm from "@/components/NewProjectForm";
import FaviconThumb from "@/components/FaviconThumb";
import MiniTrendSparkline from "@/components/MiniTrendSparkline";
import { computeProjectStats } from "@/lib/projectStats";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2">
      <p className="text-[11px] text-neutral-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-lg font-semibold text-neutral-900 leading-tight">{value}</p>
      {hint && <p className="text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

// One column of a project card's metric row — Ahrefs-style: small uppercase
// label on top, the number front and center underneath.
function ProjectMetric({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="min-w-[62px] flex items-baseline gap-1">
      <p className={`text-[13px] font-semibold leading-tight ${valueClassName ?? "text-neutral-900"}`}>{value}</p>
      <p className="text-[11px] text-neutral-400 leading-tight">{label}</p>
    </div>
  );
}

export default async function Home() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      competitors: true,
      _count: { select: { keywords: true, competitors: true } },
      keywords: {
        where: { archivedAt: null },
        include: {
          rankings: {
            orderBy: { checkedAt: "desc" },
            take: 10,
          },
        },
      },
    },
  });

  const withStats = projects.map((project) => ({
    project,
    stats: computeProjectStats(project.keywords, project.domain),
  }));

  const totalKeywords = withStats.reduce(
    (sum, p) => sum + p.stats.trackedKeywords,
    0
  );
  const allPositions = withStats.flatMap(({ stats }) =>
    stats.avgPosition != null
      ? Array(stats.withPosition).fill(stats.avgPosition)
      : []
  );
  const totalTop10 = withStats.reduce((sum, p) => sum + p.stats.top10, 0);
  const totalTop3 = withStats.reduce((sum, p) => sum + p.stats.top3, 0);

  const gscConnectedProjects = projects.filter((p) => p.gscSiteUrl);
  const totalClicks = gscConnectedProjects.reduce(
    (sum, p) => sum + (p.gscClicks28d ?? 0),
    0
  );
  const totalImpressions = gscConnectedProjects.reduce(
    (sum, p) => sum + (p.gscImpressions28d ?? 0),
    0
  );

  const overallAvgPosition =
    allPositions.length > 0
      ? (
          allPositions.reduce((a, b) => a + b, 0) / allPositions.length
        ).toFixed(1)
      : "—";

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      {/* Global bar — same dark strip as the project dashboard, so the
          project list reads as part of the same app instead of a
          different, older screen. */}
      <div className="h-12 bg-[#14171C] flex items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={22} height={22} className="shrink-0 rounded" />
          <span className="text-white text-sm font-medium tracking-tight truncate">
            Shopify Audit
          </span>
        </div>
        <a
          href="/api/logout"
          className="text-xs bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 rounded-md px-3 py-1.5 transition-colors whitespace-nowrap shrink-0"
        >
          Cerrar sesión
        </a>
      </div>

      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-10 py-3 sm:py-4">
        <header className="mb-2.5 flex items-baseline gap-2">
          <h1 className="text-[15px] font-semibold tracking-tight text-neutral-900">
            Proyectos
          </h1>
          <p className="text-neutral-400 text-[12px]">
            Resumen de posiciones y visibilidad de todos tus proyectos.
          </p>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 mb-3">
          <StatCard label="Proyectos" value={String(projects.length)} />
          <StatCard label="Keywords" value={String(totalKeywords)} />
          <StatCard label="Posicion prom." value={overallAvgPosition} />
          <StatCard label="En Top 3" value={String(totalTop3)} />
          <StatCard label="En Top 10" value={String(totalTop10)} />
          <StatCard
            label="Clics GSC (28d)"
            value={totalClicks.toLocaleString("es-MX")}
            hint={`${totalImpressions.toLocaleString("es-MX")} impresiones`}
          />
        </section>

        <section className="mb-3">
          <NewProjectForm />
        </section>

        <section className="flex flex-col gap-1">
          {projects.length === 0 && (
            <p className="text-neutral-400 text-sm">
              Aun no hay proyectos. Crea el primero arriba.
            </p>
          )}
          {withStats.map(({ project, stats }) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="flex items-center flex-wrap gap-x-4 gap-y-1.5 bg-white border border-neutral-200 hover:border-neutral-300 rounded-lg px-3 py-1.5 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:shrink-0 sm:basis-56">
                <FaviconThumb domain={project.domain} size={22} />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-neutral-900 truncate leading-tight">
                    {project.name}
                  </p>
                  <p className="text-neutral-400 text-[12px] truncate leading-tight">
                    {project.domain}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span
                  className={`text-[11px] rounded-md px-1.5 py-0.5 whitespace-nowrap ${
                    project.gscSiteUrl
                      ? "bg-[#E6F4EC] text-[#155D34]"
                      : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {project.gscSiteUrl ? "GSC" : "Sin GSC"}
                </span>
                {project.gaConnectedAt && (
                  <span className="text-[11px] rounded-md px-1.5 py-0.5 bg-[#E6F4EC] text-[#155D34] whitespace-nowrap">
                    GA4
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-0.5 flex-1 min-w-0">
                <ProjectMetric label="Keywords" value={String(project._count.keywords)} />
                <ProjectMetric
                  label="Pos. prom."
                  value={stats.avgPosition != null ? stats.avgPosition.toFixed(1) : "—"}
                />
                <ProjectMetric label="Top 3" value={String(stats.top3)} valueClassName="text-[#155D34]" />
                <ProjectMetric label="Top 10" value={String(stats.top10)} valueClassName="text-[#155D34]" />
                {project.gscSiteUrl && (
                  <>
                    <ProjectMetric
                      label="Clics (28d)"
                      value={(project.gscClicks28d ?? 0).toLocaleString("es-MX")}
                    />
                    <ProjectMetric
                      label="Impr. (28d)"
                      value={(project.gscImpressions28d ?? 0).toLocaleString("es-MX")}
                    />
                  </>
                )}
              </div>
              {project.gscSiteUrl && <MiniTrendSparkline projectId={project.id} />}
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
