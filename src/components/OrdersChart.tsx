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

export default function OrdersChart({
  data,
}: {
  data: { date: string; transactions: number; revenue: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-neutral-400 text-xs py-6 text-center">
        Sin pedidos en este periodo.
      </p>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(`${d.date}T00:00:00`).toLocaleDateString("es-MX", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="label" stroke="#a3a3a3" fontSize={11} />
        <YAxis stroke="#a3a3a3" fontSize={11} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: "#ffffff", border: "1px solid #e5e5e5", fontSize: 12 }}
          formatter={(value) => [value, "Pedidos"]}
        />
        <Bar dataKey="transactions" name="Pedidos" fill="#1A73E8" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
