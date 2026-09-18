"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export interface SharePieSlice {
  label: string;
  value: number;
  color: string;
}

// Generic donut/pie for "share of X by category" breakdowns (device mix,
// traffic channels, etc.) — legend is rendered separately by the caller
// (as the existing colored-dot label rows) so this stays a plain chart.
export default function SharePieChart({
  data,
  valueFormatter = (v: number) => v.toLocaleString("es-MX"),
}: {
  data: SharePieSlice[];
  valueFormatter?: (value: number) => string;
}) {
  const slices = data.filter((d) => d.value > 0);
  if (slices.length === 0) {
    return <p className="text-neutral-400 text-xs py-6 text-center">Sin datos.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={42}
          outerRadius={72}
          paddingAngle={2}
          stroke="#ffffff"
          strokeWidth={2}
        >
          {slices.map((s) => (
            <Cell key={s.label} fill={s.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#ffffff", border: "1px solid #e5e5e5", fontSize: 12 }}
          formatter={(value, _name, entry) => [
            valueFormatter(Number(value)),
            (entry as { payload?: { label?: string } })?.payload?.label ?? "",
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
