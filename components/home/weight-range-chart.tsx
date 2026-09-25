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
  backgroundColor: "rgba(12, 12, 14, 0.96)",
  border: "1px solid rgba(212, 175, 55, 0.22)",
  borderRadius: "14px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
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
    const dates = [
      ...new Set([...weights.map((w) => w.date), ...waists.map((w) => w.date)]),
    ].sort();
    return dates.map((date) => ({
      date,
      kg: weights.find((w) => w.date === date)?.kg ?? null,
      waist: waists.find((w) => w.date === date)?.cm ?? null,
    }));
  }, [data, waist, range]);

  return (
    <section className="rounded-[22px] border border-white/[0.1] bg-[#121214] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Waga i pas
          </p>
          <p className="mt-1 text-xs text-white/40">
            Linie zmieniają się płynnie przy zmianie zakresu
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full bg-[#d4af37]" />
            Waga
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-3 rounded-full bg-[#86efac]" />
            Pas
          </span>
        </div>
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
                "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-200",
                active
                  ? "bg-[var(--gym-gold)] text-black"
                  : "bg-white/[0.05] text-white/45 hover:bg-white/[0.08] hover:text-white/70",
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            key={range}
            data={filtered}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
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
              formatter={(value, name) => {
                const n =
                  typeof value === "number"
                    ? String(Math.round(value * 10) / 10).replace(".", ",")
                    : value;
                if (name === "kg" || name === "Waga") return [`${n} kg`, "Waga"];
                if (name === "waist" || name === "Pas") return [`${n} cm`, "Pas"];
                return [n, name];
              }}
            />
            <Line
              yAxisId="kg"
              type="monotone"
              dataKey="kg"
              name="Waga"
              stroke="#d4af37"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "#d4af37", strokeWidth: 0 }}
              connectNulls
              isAnimationActive
              animationDuration={750}
              animationEasing="ease-in-out"
            />
            <Line
              yAxisId="waist"
              type="monotone"
              dataKey="waist"
              name="Pas"
              stroke="#86efac"
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4, fill: "#86efac", strokeWidth: 0 }}
              connectNulls
              isAnimationActive
              animationDuration={750}
              animationEasing="ease-in-out"
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
