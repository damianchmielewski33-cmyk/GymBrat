"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Dot,
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
  { id: "month", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 90 },
  { id: "year", label: "1R", days: 365 },
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

function formatFullDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatNum(n: number, digits = 1): string {
  return String(Math.round(n * 10 ** digits) / 10 ** digits).replace(".", ",");
}

export function HomeSylwetkaChart({
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

  const showDots = filtered.length > 0 && filtered.length <= 24;
  const lastKgIndex = (() => {
    for (let i = filtered.length - 1; i >= 0; i--) {
      if (filtered[i]?.kg != null) return i;
    }
    return -1;
  })();
  const hasData = data.length > 0 || waist.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-8 text-center text-sm text-white/40">
        Brak pomiarów wagi i pasa — dodaj raport albo ważenie.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1.5 text-[var(--gym-gold)]">
            <span className="h-1.5 w-3 rounded-full bg-[var(--gym-gold)]" />
            Waga
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#86efac]">
            <span className="h-1.5 w-3 rounded-full bg-[#86efac]" />
            pas
          </span>
        </div>
        <div
          className="flex flex-wrap justify-end gap-1"
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
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
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
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            key={range}
            data={filtered}
            margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              yAxisId="kg"
              tick={{ fill: "rgba(232,197,71,0.65)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={36}
              domain={["dataMin - 1", "dataMax + 1"]}
              tickFormatter={(v) => formatNum(Number(v), 1)}
            />
            <YAxis
              yAxisId="waist"
              orientation="right"
              tick={{ fill: "rgba(134,239,172,0.7)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={36}
              domain={["dataMin - 1", "dataMax + 1"]}
              tickFormatter={(v) => formatNum(Number(v), 1)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(label) => formatFullDate(String(label))}
              formatter={(value, name) => {
                if (value == null || typeof value !== "number") return ["—", name];
                if (name === "kg" || name === "Waga") {
                  return [`${formatNum(value)} kg`, "Waga"];
                }
                if (name === "waist" || name === "Pas") {
                  return [`${formatNum(value)} cm`, "Pas"];
                }
                return [formatNum(value), name];
              }}
            />
            <Line
              yAxisId="kg"
              type="monotone"
              dataKey="kg"
              name="Waga"
              stroke="#d4af37"
              strokeWidth={2.4}
              dot={
                showDots
                  ? (props) => {
                      const { cx, cy, payload } = props;
                      if (payload?.kg == null || cx == null || cy == null) {
                        return <g key={props.index} />;
                      }
                      const isLast = props.index === lastKgIndex;
                      return (
                        <g key={`kg-${props.index}`}>
                          <Dot
                            cx={cx}
                            cy={cy}
                            r={isLast ? 4.5 : 3}
                            fill="#d4af37"
                            strokeWidth={0}
                          />
                          {isLast ? (
                            <text
                              x={cx}
                              y={cy - 10}
                              textAnchor="middle"
                              fill="rgba(232,197,71,0.95)"
                              fontSize={11}
                              fontWeight={600}
                            >
                              {formatNum(payload.kg as number)}
                            </text>
                          ) : null}
                        </g>
                      );
                    }
                  : { r: 3, fill: "#d4af37", strokeWidth: 0 }
              }
              activeDot={{ r: 5, fill: "#d4af37", strokeWidth: 0 }}
              connectNulls
              isAnimationActive
              animationDuration={700}
            />
            <Line
              yAxisId="waist"
              type="monotone"
              dataKey="waist"
              name="Pas"
              stroke="#86efac"
              strokeWidth={2.1}
              dot={false}
              activeDot={{ r: 4, fill: "#86efac", strokeWidth: 0 }}
              connectNulls
              isAnimationActive
              animationDuration={700}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-white/40">Brak pomiarów w tym zakresie.</p>
      ) : null}
    </div>
  );
}
