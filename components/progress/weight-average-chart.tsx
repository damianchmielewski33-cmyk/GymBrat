"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProgressWeightPoint } from "@/lib/progress-hub";

const GOLD = "#ebc44a";

const tooltipStyle = {
  backgroundColor: "rgba(12, 12, 14, 0.96)",
  border: "1px solid rgba(235, 196, 74, 0.28)",
  borderRadius: "14px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  padding: "10px 12px",
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });
}

/** Rolling average (window 3) over weight report points. */
function withAverage(points: ProgressWeightPoint[]) {
  return points.map((p, i) => {
    const from = Math.max(0, i - 2);
    const slice = points.slice(from, i + 1);
    const avg = slice.reduce((s, x) => s + x.kg, 0) / slice.length;
    return { date: p.date, kg: p.kg, avg: Math.round(avg * 10) / 10 };
  });
}

export function WeightAverageChart({ weights }: { weights: ProgressWeightPoint[] }) {
  const data = useMemo(() => withAverage(weights), [weights]);

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-xs text-white/40">
        Dodaj raporty lub ważenia, żeby zobaczyć wykres wagi.
      </div>
    );
  }

  return (
    <div className="h-[240px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={28}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => formatShortDate(String(v))}
            formatter={(value, name) => {
              const n = Number(value);
              const label = name === "avg" ? "Średnia" : "Raport";
              return [
                `${n.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} kg`,
                label,
              ];
            }}
          />
          <Line
            type="monotone"
            dataKey="avg"
            stroke={GOLD}
            strokeWidth={2}
            dot={false}
            name="avg"
            isAnimationActive={false}
          />
          <Scatter dataKey="kg" fill={GOLD} name="kg" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
