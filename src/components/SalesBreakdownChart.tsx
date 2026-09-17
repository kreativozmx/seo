"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export interface SalesBreakdownPoint {
  label: string;
  revenue: number;
}

export default function SalesBreakdownChart({ data }: { data: SalesBreakdownPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-neutral-400 text-xs py-6 text-center">Sin datos.</p>
    );
  }

  // Top 8, longest bar first — reversed so recharts renders it at the top.
  const chartData = data
    .slice()
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
    .reverse();

  const height = Math.max(chartData.length * 34, 120);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
        <XAxis
          type="number"
          stroke="#a3a3a3"
          fontSize={11}
          tickFormatter={(v) => `$${Number(v).toLocaleString("es-MX")}`}
        />
        <YAxis
          type="category"
          dataKey="label"
          stroke="#a3a3a3"
          fontSize={11}
          width={140}
          tick={{ fill: "#525252" }}
        />
        <Tooltip
          cursor={{ fill: "#f5f5f5" }}
          contentStyle={{ background: "#ffffff", border: "1px solid #e5e5e5", fontSize: 12 }}
          formatter={(value) => [`$${Number(value).toLocaleString("es-MX")}`, "Ventas"]}
        />
        <Bar dataKey="revenue" fill="#228449" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
