"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ChartCaptureButton } from "@/components/dashboard/ChartCaptureButton";

interface HistoryPoint {
  date: string;
  clicks: number;
  impressions: number;
  position: number;
}

type MetricKey = "clicks" | "impressions" | "position";

const METRICS: Record<MetricKey, { label: string; color: string; invertYAxis?: boolean }> = {
  clicks: { label: "Clics", color: "#228449" },
  impressions: { label: "Impresiones", color: "#5F6368" },
  position: { label: "Posicion promedio", color: "#d97706", invertYAxis: true },
};

const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 28, label: "28 dias" },
  { value: 90, label: "90 dias" },
  { value: 180, label: "6 meses" },
  { value: 365, label: "12 meses" },
];

// Real day-by-day Search Console history (see /api/projects/[id]/gsc/history)
// rendered as an Ahrefs-style area chart — the trend line is exact, not a
// simulation, since GSC already keeps up to ~16 months of daily totals.
export default function OrganicTrafficChart({ projectId }: { projectId: string }) {
  const [days, setDays] = useState(90);
  const [metric, setMetric] = useState<MetricKey>("clicks");
  const [points, setPoints] = useState<HistoryPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/projects/${projectId}/gsc/history?days=${days}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al cargar el historico");
        if (!cancelled) setPoints(data.points);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar el historico");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, days]);

  const config = METRICS[metric];

  const chartData = (points ?? []).map((p) => ({
    ...p,
    label: new Date(`${p.date}T00:00:00`).toLocaleDateString("es-MX", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <div ref={captureRef} className="bg-white border border-neutral-200 rounded-xl px-4 py-4">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <p className="text-sm font-medium text-neutral-900">Trafico organico (Search Console)</p>
        <div className="flex items-center gap-3">
          <div className="flex bg-neutral-100 rounded-md p-0.5 text-[13px]">
            {(Object.keys(METRICS) as MetricKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setMetric(key)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  metric === key ? "bg-white shadow-sm text-neutral-900 font-medium" : "text-neutral-500"
                }`}
              >
                {METRICS[key].label}
              </button>
            ))}
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="bg-white border border-neutral-200 rounded-md px-2 py-1 text-[13px] outline-none focus:border-[#228449] transition-colors"
          >
            {DAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChartCaptureButton targetRef={captureRef} filename={`trafico-organico-${metric}`} />
        </div>
      </div>

      {loading ? (
        <div className="h-[220px] flex items-center justify-center">
          <span className="w-5 h-5 rounded-full border-2 border-neutral-200 border-t-neutral-400 animate-spin" />
        </div>
      ) : error ? (
        <p className="text-xs text-red-600 py-6 text-center">{error}</p>
      ) : chartData.length === 0 ? (
        <p className="text-neutral-400 text-xs py-6 text-center">Sin datos de Search Console en este periodo.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="organicTrafficFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={config.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="label" stroke="#a3a3a3" fontSize={11} minTickGap={30} />
            <YAxis
              stroke="#a3a3a3"
              fontSize={11}
              allowDecimals={metric === "position"}
              reversed={config.invertYAxis}
              tickFormatter={(v) => (metric === "position" ? v.toFixed(0) : v.toLocaleString("es-MX"))}
            />
            <Tooltip
              contentStyle={{ background: "#ffffff", border: "1px solid #e5e5e5", fontSize: 12 }}
              formatter={(value) => [
                metric === "position" ? Number(value).toFixed(1) : Number(value).toLocaleString("es-MX"),
                config.label,
              ]}
            />
            <Area
              type="monotone"
              dataKey={metric}
              name={config.label}
              stroke={config.color}
              strokeWidth={2}
              fill="url(#organicTrafficFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
