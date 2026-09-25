"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import { cn } from "@/lib/utils";
import type { HomeStartWaistPoint, HomeStartWeightPoint } from "@/lib/home-start";

const RANGES = [
  { id: "month", label: "Miesiąc", days: 30 },
  { id: "3m", label: "3 mies.", days: 90 },
  { id: "year", label: "Rok", days: 365 },
  { id: "all", label: "Całość", days: 4000 },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

const tooltipStyle = {
  backgroundColor: "rgba(7, 8, 13, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "14px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.9)",
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });
}

export function WeightRangeChart({
  data,
  waist = [],
}: {
  data: HomeStartWeightPoint[];
  waist?: HomeStartWaistPoint[];
}) {
  const [range, setRange] = useState<RangeId>("all");

  const filtered = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? 4000;
    const today = calendarDateKey();
    const from = addCalendarDays(today, -(days - 1));
    const weights = data.filter((p) => p.date >= from && p.date <= today);
    const waists = waist.filter((p) => p.date >= from && p.date <= today);
    const dates = [...new Set([...weights.map((w) => w.date), ...waists.map((w) => w.date)])].sort();
    return dates.map((date) => ({
      date,
      kg: weights.find((w) => w.date === date)?.kg ?? null,
      waist: waists.find((w) => w.date === date)?.cm ?? null,
    }));
  }, [data, waist, range]);

  return (
    <section className="app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="app-label">Waga i pas</p>
      </div>
      <div
        className="mt-3 flex flex-wrap gap-1.5"
        role="tablist"
        aria-label="Zakres wykresu wagi"
      >
        {RANGES.map((r) => {
          const active = range === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
                active
                  ? "bg-[var(--neon)] text-[var(--neon-fg)]"
                  : "bg-white/[0.04] text-white/45",
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="kg"
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
              domain={["auto", "auto"]}
            />
            <YAxis
              yAxisId="waist"
              orientation="right"
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(label) => formatShortDate(String(label))}
            />
            <Line
              yAxisId="kg"
              type="monotone"
              dataKey="kg"
              stroke="#d4af37"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              yAxisId="waist"
              type="monotone"
              dataKey="waist"
              stroke="#86efac"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-3 text-xs text-white/40">
          Brak pomiarów w tym zakresie — dodaj ważenie w Analizie albo w raporcie.
        </p>
      ) : null}
    </section>
  );
}
