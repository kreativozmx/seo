"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { RankingDTO } from "@/lib/types";

const COLORS = [
  "#1A73E8",
  "#2563eb",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#db2777",
];

// null = whole history. For the 24h window we group by hour instead of by
// day, since day-only buckets would otherwise collapse everything into a
// single "today" point.
export type ChartPeriod = "24h" | "7d" | "30d" | "90d" | "all";

const PERIOD_HOURS: Record<ChartPeriod, number | null> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
  all: null,
};

export default function RankingChart({
  rankings,
  domains,
  period = "all",
}: {
  rankings: RankingDTO[];
  domains: string[];
  period?: ChartPeriod;
}) {
  const windowHours = PERIOD_HOURS[period];
  const cutoff = windowHours != null ? Date.now() - windowHours * 60 * 60 * 1000 : null;
  const filtered =
    cutoff != null ? rankings.filter((r) => new Date(r.checkedAt).getTime() >= cutoff) : rankings;

  const byDate = new Map<string, Record<string, number | null>>();

  for (const r of filtered) {
    const dateKey =
      period === "24h"
        ? new Date(r.checkedAt).toLocaleString("es-MX", {
            day: "numeric",
            month: "short",
            hour: "numeric",
          })
        : new Date(r.checkedAt).toLocaleDateString("es-MX", {
            month: "short",
            day: "numeric",
          });
    if (!byDate.has(dateKey)) byDate.set(dateKey, {});
    const entry = byDate.get(dateKey)!;
    entry[r.domain] = r.position;
  }

  const data = Array.from(byDate.entries())
    .map(([date, values]) => ({ date, ...values }))
    .reverse();

  if (data.length === 0) {
    return (
      <p className="text-neutral-400 text-xs py-6 text-center">
        Sin historial en este periodo.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
        <XAxis dataKey="date" stroke="#a3a3a3" fontSize={11} />
        <YAxis
          reversed
          stroke="#a3a3a3"
          fontSize={11}
          allowDecimals={false}
          domain={[1, "dataMax"]}
        />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {domains.map((domain, i) => (
          <Line
            key={domain}
            type="monotone"
            dataKey={domain}
            stroke={COLORS[i % COLORS.length]}
            connectNulls
            dot={{ r: 2 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
