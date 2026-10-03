"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
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

function formatAxisDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

function formatTooltipDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

/** Rolling average (window 3) over weight report points. */
function withAverage(points: ProgressWeightPoint[]) {
  return points.map((p, i) => {
    const from = Math.max(0, i - 2);
    const slice = points.slice(from, i + 1);
    const avg = slice.reduce((s, x) => s + x.kg, 0) / slice.length;
    const isLast = i === points.length - 1;
    return {
      date: p.date,
      kg: p.kg,
      avg: Math.round(avg * 10) / 10,
      /** Osobny klucz — złota kropka tylko na ostatnim punkcie. */
      lastKg: isLast ? p.kg : null,
    };
  });
}

export function WeightAverageChart({
  weights,
}: {
  weights: ProgressWeightPoint[];
}) {
  const data = useMemo(() => withAverage(weights), [weights]);

  const yDomain = useMemo(() => {
    if (!data.length) return [0, 100] as [number, number];
    const vals = data.flatMap((d) => [d.kg, d.avg]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max(1.5, (max - min) * 0.18);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10] as [
      number,
      number,
    ];
  }, [data]);

  const lastDate = data.length ? data[data.length - 1]!.date : null;
  const firstDate = data.length ? data[0]!.date : null;

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center text-xs text-white/40">
        Dodaj raporty lub ważenia, żeby zobaczyć wykres wagi.
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="weightAvgFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
            horizontal
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatAxisDate}
            ticks={
              firstDate && lastDate && firstDate !== lastDate
                ? [firstDate, lastDate]
                : undefined
            }
            tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            padding={{ left: 8, right: 8 }}
          />
          <YAxis
            orientation="right"
            domain={yDomain}
            tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v) =>
              Number(v).toLocaleString("pl-PL", { maximumFractionDigits: 1 })
            }
            tickCount={3}
          />
          {lastDate ? (
            <ReferenceLine
              x={lastDate}
              stroke="rgba(255,255,255,0.22)"
              strokeDasharray="3 4"
            />
          ) : null}
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(v) => formatTooltipDate(String(v))}
            formatter={(value, name) => {
              const n = Number(value);
              if (!Number.isFinite(n) || name === "lastKg") return [null, ""];
              const label = name === "avg" ? "Średnia" : "Raport";
              return [
                `${n.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} kg`,
                label,
              ];
            }}
          />
          <Area
            type="monotone"
            dataKey="avg"
            stroke="none"
            fill="url(#weightAvgFill)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="avg"
            stroke={GOLD}
            strokeWidth={2.25}
            dot={false}
            name="avg"
            isAnimationActive={false}
          />
          <Scatter
            dataKey="kg"
            fill="rgba(255,255,255,0.45)"
            name="kg"
            shape={(props: { cx?: number; cy?: number }) => {
              const { cx = 0, cy = 0 } = props;
              return (
                <circle
                  cx={cx}
                  cy={cy}
                  r={3.2}
                  fill="rgba(255,255,255,0.42)"
                />
              );
            }}
          />
          <Scatter
            dataKey="lastKg"
            fill={GOLD}
            name="lastKg"
            shape={(props: { cx?: number; cy?: number; payload?: { lastKg?: number | null } }) => {
              if (props.payload?.lastKg == null) return <g />;
              const { cx = 0, cy = 0 } = props;
              return (
                <g>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={7}
                    fill={GOLD}
                    fillOpacity={0.22}
                  />
                  <circle cx={cx} cy={cy} r={4.2} fill={GOLD} />
                </g>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
