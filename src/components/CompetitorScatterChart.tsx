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

const COLORS = ["#1A73E8", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d"];

// Simple least-squares fit across the currently visible domains, so the
// line represents "what's typical for this group" rather than a fixed
// external benchmark. A point above the line gets more organic traffic
// than its traffic-value would predict (efficient/well-optimized); a
// point below it is paying (in ad-equivalent terms) for less traffic than
// its peers get.
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

export default function CompetitorScatterChart({ points }: { points: CompetitorPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-neutral-400 text-xs py-6 text-center">
        Analiza tu dominio y al menos un competidor para ver la comparacion.
      </p>
    );
  }

  const fit = linearRegression(
    points.map((p) => ({ x: p.trafficValue, y: p.organicTraffic }))
  );
  const maxX = Math.max(...points.map((p) => p.trafficValue), 0) * 1.05;
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
          dataKey="trafficValue"
          name="Valor del trafico"
          stroke="#a3a3a3"
          fontSize={11}
          tickFormatter={(v) => `$${v.toLocaleString("es-MX")}`}
          label={{ value: "Valor del trafico organico est.", position: "insideBottom", offset: -5, fontSize: 11, fill: "#a3a3a3" }}
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
        <ZAxis type="number" dataKey="organicKeywords" range={[80, 900]} name="Keywords organicas" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{ background: "#ffffff", border: "1px solid #e5e5e5", fontSize: 12 }}
          formatter={(value, name) => {
            const n = Number(value);
            if (name === "Valor del trafico") return [`$${n.toLocaleString("es-MX")}`, name];
            return [n.toLocaleString("es-MX"), name];
          }}
          labelFormatter={() => ""}
        />
        {points.map((p, i) => (
          <Scatter
            key={p.domain}
            name={p.domain}
            data={[p]}
            fill={p.isOwn ? "#1A73E8" : COLORS[(i + 1) % COLORS.length]}
            stroke={p.isOwn ? "#1A73E8" : COLORS[(i + 1) % COLORS.length]}
            strokeWidth={p.isOwn ? 2 : 1}
            fillOpacity={p.isOwn ? 0.85 : 0.45}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
