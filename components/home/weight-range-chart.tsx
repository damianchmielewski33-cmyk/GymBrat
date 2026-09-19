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
import type { HomeStartWeightPoint } from "@/lib/home-start";

const RANGES = [
  { id: "week", label: "Tydzień", days: 7 },
  { id: "month", label: "Miesiąc", days: 30 },
  { id: "3m", label: "3 miesiące", days: 90 },
  { id: "6m", label: "Pół roku", days: 182 },
  { id: "year", label: "Rok", days: 365 },
] as const;

type RangeId = (typeof RANGES)[number]["id"];

const tooltipStyle = {
  backgroundColor: "rgba(7, 8, 13, 0.92)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.9)",
};

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", { month: "short", day: "numeric" });
}

export function WeightRangeChart({ data }: { data: HomeStartWeightPoint[] }) {
  const [range, setRange] = useState<RangeId>("month");

  const filtered = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? 30;
    const today = calendarDateKey();
    const from = addCalendarDays(today, -(days - 1));
    return data.filter((p) => p.date >= from && p.date <= today);
  }, [data, range]);

  return (
    <section className="glass-panel neon-glow relative flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-5">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(135deg,rgba(255,45,85,0.12),transparent_55%)]" />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/50">
              Masa ciała
            </p>
            <h2 className="font-heading mt-1 text-base font-semibold text-white sm:text-lg">
              Wykres wagi
            </h2>
            <p className="mt-1 text-xs text-white/50">
              Linia z zapisanych ważeń w wybranym zakresie.
            </p>
          </div>
          <div
            className="flex flex-wrap gap-1.5"
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
                    "rounded-lg border px-2 py-1 text-[11px] font-medium transition sm:px-2.5 sm:py-1.5 sm:text-xs",
                    active
                      ? "border-[var(--neon)]/50 bg-[var(--neon)]/15 text-white"
                      : "border-white/12 bg-black/30 text-white/55 hover:bg-white/[0.06] hover:text-white/80",
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 h-[200px] w-full flex-1 sm:h-[220px] lg:min-h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filtered} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label) => formatShortDate(String(label))}
                formatter={(value) => [`${Number(value ?? 0)} kg`, "Masa"]}
              />
              <Line
                type="monotone"
                dataKey="kg"
                stroke="#ff2d55"
                strokeWidth={2}
                dot={{ r: 3, fill: "#ff2d55", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#ff2d55", stroke: "#fff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-2 text-xs text-white/45">
            Brak pomiarów w tym zakresie — dodaj ważenie w Analizie albo w raporcie.
          </p>
        ) : null}
      </div>
    </section>
  );
}
