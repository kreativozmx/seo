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
} from "recharts";

export interface CompetitorPoint {
  domain: string;
  organicTraffic: number;
  trafficValue: number;
  organicKeywords: number;
  isOwn: boolean;
}

const COLORS = ["#1A73E8", "#059669", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d"];

export default function CompetitorScatterChart({ points }: { points: CompetitorPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-neutral-400 text-xs py-6 text-center">
        Analiza tu dominio y al menos un competidor para ver la comparacion.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
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
