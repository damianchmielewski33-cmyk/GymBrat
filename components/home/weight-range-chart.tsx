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

  const summary = useMemo(() => {
    const withKg = filtered.filter((p) => p.kg != null);
    const withWaist = filtered.filter((p) => p.waist != null);
    const firstKg = withKg[0]?.kg ?? null;
    const lastKg = withKg[withKg.length - 1]?.kg ?? null;
    const firstWaist = withWaist[0]?.waist ?? null;
    const lastWaist = withWaist[withWaist.length - 1]?.waist ?? null;
    const lastPoint = filtered[filtered.length - 1] ?? null;
    return {
      firstKg,
      lastKg,
      deltaKg:
        firstKg != null && lastKg != null
          ? Math.round((lastKg - firstKg) * 10) / 10
          : null,
      firstWaist,
      lastWaist,
      deltaWaist:
        firstWaist != null && lastWaist != null
          ? Math.round((lastWaist - firstWaist) * 10) / 10
          : null,
      lastDate: lastPoint?.date ?? null,
      points: filtered.length,
    };
  }, [filtered]);

  const showDots = filtered.length > 0 && filtered.length <= 24;

  return (
    <section className="rounded-[22px] border border-white/[0.1] bg-[#121214] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Waga i pas
          </p>
          <p className="mt-1 text-xs text-white/40">
            Dokładne wartości na punktach i w podsumowaniu zakresu
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

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-white/10 bg-[#1c1c20] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Waga
          </p>
          <p className="mt-1 font-display text-[22px] tabular-nums text-[#e8c547]">
            {summary.lastKg != null ? `${formatNum(summary.lastKg)} kg` : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {summary.deltaKg != null
              ? `${summary.deltaKg > 0 ? "+" : ""}${formatNum(summary.deltaKg)} kg w zakresie`
              : "brak zmiany"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#1c1c20] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Pas
          </p>
          <p className="mt-1 font-display text-[22px] tabular-nums text-[#86efac]">
            {summary.lastWaist != null ? `${formatNum(summary.lastWaist)} cm` : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {summary.deltaWaist != null
              ? `${summary.deltaWaist > 0 ? "+" : ""}${formatNum(summary.deltaWaist)} cm w zakresie`
              : "brak zmiany"}
          </p>
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

      <div className="mt-4 h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            key={range}
            data={filtered}
            margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              yAxisId="kg"
              tick={{ fill: "rgba(232,197,71,0.7)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
              domain={["dataMin - 1", "dataMax + 1"]}
              tickFormatter={(v) => formatNum(Number(v), 1)}
              unit=""
            />
            <YAxis
              yAxisId="waist"
              orientation="right"
              tick={{ fill: "rgba(134,239,172,0.75)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
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
              strokeWidth={2.5}
              dot={
                showDots
                  ? (props) => {
                      const { cx, cy, payload } = props;
                      if (payload?.kg == null || cx == null || cy == null) {
                        return <g key={props.index} />;
                      }
                      return (
                        <g key={`kg-${props.index}`}>
                          <Dot cx={cx} cy={cy} r={3.5} fill="#d4af37" strokeWidth={0} />
                          <text
                            x={cx}
                            y={cy - 8}
                            textAnchor="middle"
                            fill="rgba(232,197,71,0.95)"
                            fontSize={10}
                            fontWeight={600}
                          >
                            {formatNum(payload.kg as number)}
                          </text>
                        </g>
                      );
                    }
                  : { r: 3, fill: "#d4af37", strokeWidth: 0 }
              }
              activeDot={{ r: 5, fill: "#d4af37", strokeWidth: 0 }}
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
              dot={
                showDots
                  ? (props) => {
                      const { cx, cy, payload } = props;
                      if (payload?.waist == null || cx == null || cy == null) {
                        return <g key={props.index} />;
                      }
                      return (
                        <g key={`w-${props.index}`}>
                          <Dot cx={cx} cy={cy} r={3.5} fill="#86efac" strokeWidth={0} />
                          <text
                            x={cx}
                            y={cy + 14}
                            textAnchor="middle"
                            fill="rgba(134,239,172,0.95)"
                            fontSize={10}
                            fontWeight={600}
                          >
                            {formatNum(payload.waist as number)}
                          </text>
                        </g>
                      );
                    }
                  : { r: 3, fill: "#86efac", strokeWidth: 0 }
              }
              activeDot={{ r: 5, fill: "#86efac", strokeWidth: 0 }}
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
      ) : (
        <p className="mt-3 text-[11px] text-white/35">
          {summary.points} pomiarów
          {summary.lastDate ? ` · ostatni: ${formatFullDate(summary.lastDate)}` : ""}
          {" · "}dotknij punkt, żeby zobaczyć dokładną datę i wartość
        </p>
      )}
    </section>
  );
}
