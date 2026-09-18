"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

interface HistoryPoint {
  date: string;
  clicks: number;
  impressions: number;
  position: number;
}

// Small inline "how's this trending" preview per project row, like Ahrefs'
// sparklines next to Trafico organico / Palabras clave in its project list —
// pulls the same real GSC daily history used by the full chart in the
// Panel tab, just condensed and chartless (no axes/labels).
export default function MiniTrendSparkline({ projectId }: { projectId: string }) {
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/gsc/history?days=30`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "error");
        if (!cancelled) setPoints(data.points);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const total = (points ?? []).reduce((sum, p) => sum + p.clicks, 0);

  if (failed || (points && total === 0)) {
    return <div className="w-[84px] h-7 shrink-0" />;
  }

  if (!points) {
    return (
      <div className="w-[84px] h-7 shrink-0 flex items-center">
        <span className="w-full h-3 rounded bg-neutral-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-[84px] h-7 shrink-0" title={`${total.toLocaleString("es-MX")} clics en 30 dias`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${projectId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#228449" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#228449" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{ background: "#ffffff", border: "1px solid #e5e5e5", fontSize: 11, padding: "4px 8px" }}
            labelFormatter={() => ""}
            formatter={(value) => [value, "Clics"]}
          />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke="#228449"
            strokeWidth={1.5}
            fill={`url(#spark-${projectId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
