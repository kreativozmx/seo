"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export interface CompetitorPoint {
  domain: string;
  organicTraffic: number;
  trafficValue: number;
  organicKeywords: number;
  isOwn: boolean;
}

export type XMetricKey = "trafficValue";

export const X_METRICS: Record<
  XMetricKey,
  { label: string; shortLabel: string; format: (v: number) => string }
> = {
  trafficValue: {
    label: "Valor del trafico organico est.",
    shortLabel: "Valor del trafico",
    format: (v) => `$${v.toLocaleString("es-MX")}`,
  },
};

// Shared across the checkbox legend and the chart dots so a domain always
// gets the same color everywhere in the Competencia tab.
export const COMPETITOR_COLORS = [
  "#1A73E8",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#dc2626",
];

export function colorForCompetitorIndex(i: number) {
  return COMPETITOR_COLORS[i % COMPETITOR_COLORS.length];
}

// Simple least-squares fit across the currently visible domains, so the
// line represents "what's typical for this group" rather than a fixed
// external benchmark. A point above the line gets more organic traffic
// than the X metric would predict (efficient/well-optimized); a point
// below it is behind its peers for that metric.
function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export default function CompetitorScatterChart({
  points,
  xMetric,
  colorFor,
}: {
  points: CompetitorPoint[];
  xMetric: XMetricKey;
  colorFor: (domain: string) => string;
}) {
  if (points.length === 0) {
    return (
      <p className="text-neutral-400 text-xs py-6 text-center">
        Analiza tu dominio y al menos un competidor para ver la comparacion.
      </p>
    );
  }

  const xConfig = X_METRICS[xMetric];
  const xValue = (p: CompetitorPoint) => p[xMetric];

  const fit = linearRegression(points.map((p) => ({ x: xValue(p), y: p.organicTraffic })));
  const maxX = Math.max(...points.map(xValue), 0) * 1.05;
  const trendSegment: [{ x: number; y: number }, { x: number; y: number }] | null =
    fit && maxX > 0
      ? [
          { x: 0, y: Math.max(fit.intercept, 0) },
          { x: maxX, y: Math.max(fit.slope * maxX + fit.intercept, 0) },
        ]
      : null;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        {trendSegment && (
          <ReferenceLine
            segment={trendSegment}
            stroke="#d4d4d4"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            ifOverflow="extendDomain"
            label={{
              value: "Promedio del grupo",
              position: "insideTopLeft",
              fontSize: 10,
              fill: "#a3a3a3",
            }}
          />
        )}
        <XAxis
          type="number"
          dataKey={xValue}
          name={xConfig.shortLabel}
          stroke="#a3a3a3"
          fontSize={11}
          tickFormatter={xConfig.format}
          label={{ value: xConfig.label, position: "insideBottom", offset: -5, fontSize: 11, fill: "#a3a3a3" }}
        />
        <YAxis
          type="number"
          dataKey="organicTraffic"
          name="Trafico organico"
          stroke="#a3a3a3"
          fontSize={11}
          tickFormatter={(v) => v.toLocaleString("es-MX")}
          label={{ value: "Trafico organico est.", angle: -90, position: "insideLeft", fontSize: 11, fill: "#a3a3a3" }}
        />
        <ZAxis
          type="number"
          dataKey={(p: CompetitorPoint) => Math.sqrt(Math.max(p.organicTraffic, 0) * Math.max(p.trafficValue, 0))}
          range={[80, 900]}
          name="Tamaño (trafico x valor)"
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{ background: "#ffffff", border: "1px solid #e5e5e5", fontSize: 12 }}
          formatter={(value, name) => {
            const n = Number(value);
            if (name === xConfig.shortLabel) return [xConfig.format(n), name];
            return [n.toLocaleString("es-MX"), name];
          }}
          labelFormatter={() => ""}
        />
        {points.map((p) => {
          const color = colorFor(p.domain);
          return (
            <Scatter
              key={p.domain}
              name={p.domain}
              data={[p]}
              fill={color}
              stroke={color}
              strokeWidth={p.isOwn ? 2 : 1}
              fillOpacity={p.isOwn ? 0.85 : 0.55}
            />
          );
        })}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
