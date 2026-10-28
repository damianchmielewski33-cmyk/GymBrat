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

const DAY_MS = 86_400_000;
/** Hex for Recharts/SVG props (CSS var nie zawsze działa w atrybutach biblioteki). */
const GOLD = "#ebc44a";
const GREEN = "#86efac";
const Y_AXIS_WIDTH = 38;
const PLOT_HEIGHT = 112;
const X_AXIS_HEIGHT = 24;

const tooltipStyle = {
  backgroundColor: "rgba(12, 12, 14, 0.96)",
  border: "1px solid rgba(212, 175, 55, 0.22)",
  borderRadius: "14px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
};

function toTs(iso: string): number {
  return new Date(`${iso}T12:00:00`).getTime();
}

function formatShortDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(ts: number) {
  return new Date(ts).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatNum(n: number, digits = 1): string {
  return String(Math.round(n * 10 ** digits) / 10 ** digits).replace(".", ",");
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return m * pow;
}

/** Oś Y z równymi, „ładnymi” krokami i zapasem nad/pod danymi (osobno dla wagi i pasa). */
function niceScale(min: number, max: number, minSpan: number) {
  const span = Math.max(max - min, minSpan);
  const step = niceStep(span / 3);
  const pad = step * 0.5;
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  const lo = round(Math.floor((min - pad) / step) * step);
  const hi = round(Math.ceil((max + pad) / step) * step);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 1000; v = round(v + step)) ticks.push(v);
  return { lo, hi, step, ticks };
}

type Row = { ts: number; v?: number; ext?: number };

/** Znaczniki osi X: pierwszy pomiar, ostatni pomiar, „dziś” i wypełniacze bez nakładania. */
function buildXTicks(xMin: number, lastDataTs: number, todayTs: number): number[] {
  const span = todayTs - xMin;
  if (span <= 0) return [todayTs];
  const kept: number[] = [xMin, todayTs];
  const farEnough = (ts: number, gap: number) =>
    kept.every((k) => Math.abs(k - ts) >= gap);
  if (farEnough(lastDataTs, span * 0.1)) kept.push(lastDataTs);
  for (const frac of [0.25, 0.5, 0.75]) {
    const ts = xMin + span * frac;
    if (farEnough(ts, span * 0.2)) kept.push(ts);
  }
  return kept.sort((a, b) => a - b);
}

function SeriesChart({
  title,
  points,
  color,
  unit,
  todayTs,
  xDomain,
  xTicks,
  minSpan,
  tickDigits,
  showXAxis,
}: {
  title: string;
  points: { ts: number; v: number }[];
  color: string;
  unit: string;
  todayTs: number;
  xDomain: [number, number];
  xTicks: number[];
  minSpan: number;
  tickDigits: (step: number) => number;
  showXAxis: boolean;
}) {
  const { rows, scale, labelIdx } = useMemo(() => {
    const base: Row[] = points.map((p) => ({ ts: p.ts, v: p.v }));
    const last = points[points.length - 1];
    if (last && last.ts < todayTs) {
      base[base.length - 1] = { ts: last.ts, v: last.v, ext: last.v };
      base.push({ ts: todayTs, ext: last.v });
    }
    const values = points.map((p) => p.v);
    const scale = niceScale(Math.min(...values), Math.max(...values), minSpan);
    const labelIdx = new Set<number>();
    if (points.length <= 4) points.forEach((_, i) => labelIdx.add(i));
    else {
      labelIdx.add(0);
      labelIdx.add(points.length - 1);
    }
    return { rows: base, scale, labelIdx };
  }, [points, todayTs, minSpan]);

  const digits = tickDigits(scale.step);
  const hasExt = rows.some((r) => r.ext != null && r.v == null);
  const height = PLOT_HEIGHT + (showXAxis ? X_AXIS_HEIGHT : 0);

  return (
    <div>
      <div style={{ height }} className="w-full" role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 22, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
            <XAxis
              dataKey="ts"
              type="number"
              scale="linear"
              domain={xDomain}
              ticks={xTicks}
              tickFormatter={(ts: number) =>
                calendarDateKey(new Date(ts)) === calendarDateKey(new Date(todayTs))
                  ? "dziś"
                  : formatShortDate(ts)
              }
              tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              height={showXAxis ? X_AXIS_HEIGHT : 1}
              hide={!showXAxis}
            />
            <YAxis
              type="number"
              domain={[scale.lo, scale.hi]}
              ticks={scale.ticks}
              tick={{ fill: color, fontSize: 11, opacity: 0.8 }}
              axisLine={false}
              tickLine={false}
              width={Y_AXIS_WIDTH}
              tickFormatter={(v: number) => formatNum(v, digits)}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(label) => formatFullDate(Number(label))}
              formatter={(value) =>
                typeof value === "number"
                  ? [`${formatNum(value, 1)} ${unit}`, title]
                  : ["—", title]
              }
            />
            {hasExt ? (
              <Line
                type="linear"
                dataKey="ext"
                stroke={color}
                strokeOpacity={0.55}
                strokeWidth={2}
                strokeDasharray="4 4"
                tooltipType="none"
                isAnimationActive={false}
                activeDot={false}
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  if (
                    cx == null ||
                    cy == null ||
                    payload?.ts !== todayTs ||
                    payload?.v != null
                  ) {
                    return <g key={`ext-${props.index}`} />;
                  }
                  return (
                    <circle
                      key={`ext-${props.index}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#0b0b0c"
                      stroke={color}
                      strokeOpacity={0.6}
                      strokeWidth={1.6}
                    />
                  );
                }}
              />
            ) : null}
            <Line
              type="linear"
              dataKey="v"
              name={title}
              stroke={color}
              strokeWidth={2.4}
              connectNulls
              isAnimationActive
              animationDuration={600}
              activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
              dot={(props) => {
                const { cx, cy, payload, index } = props;
                if (payload?.v == null || cx == null || cy == null) {
                  return <g key={`v-${index}`} />;
                }
                const pointIndex = points.findIndex((p) => p.ts === payload.ts);
                return (
                  <g key={`v-${index}`}>
                    <Dot cx={cx} cy={cy} r={4} fill={color} strokeWidth={0} />
                    {labelIdx.has(pointIndex) ? (
                      <text
                        x={cx}
                        y={cy - 11}
                        textAnchor="middle"
                        fill={color}
                        fontSize={12}
                        fontWeight={700}
                      >
                        {formatNum(payload.v as number, 1)}
                      </text>
                    ) : null}
                  </g>
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function HomeSylwetkaChart({
  data,
  waist = [],
}: {
  data: HomeStartWeightPoint[];
  waist?: HomeStartWaistPoint[];
}) {
  const [range, setRange] = useState<RangeId>("all");

  const view = useMemo(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? 4000;
    const today = calendarDateKey();
    const from = addCalendarDays(today, -(days - 1));
    const weights = data
      .filter((p) => p.date >= from && p.date <= today)
      .map((p) => ({ ts: toTs(p.date), v: p.kg }))
      .sort((a, b) => a.ts - b.ts);
    const waists = waist
      .filter((p) => p.date >= from && p.date <= today)
      .map((p) => ({ ts: toTs(p.date), v: p.cm }))
      .sort((a, b) => a.ts - b.ts);

    const todayTs = toTs(today);
    const all = [...weights, ...waists];
    if (all.length === 0) return { weights, waists, empty: true as const };

    const xMin = Math.min(...all.map((p) => p.ts));
    const lastDataTs = Math.max(...all.map((p) => p.ts));
    const span = Math.max(todayTs - xMin, 0);
    const pad = Math.max(span * 0.04, DAY_MS);
    return {
      weights,
      waists,
      empty: false as const,
      todayTs,
      xDomain: [xMin - pad, todayTs + pad] as [number, number],
      xTicks: buildXTicks(xMin, lastDataTs, todayTs),
    };
  }, [data, waist, range]);

  const hasData = data.length > 0 || waist.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-8 text-center text-sm text-white/40">
        Brak pomiarów wagi i pasa — dodaj raport albo ważenie.
      </div>
    );
  }

  const hasWeights = view.weights.length > 0;
  const hasWaists = view.waists.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-4 text-[12px] font-semibold">
          <span className="inline-flex items-center gap-2" style={{ color: GOLD }}>
            <span
              className="h-1 w-4 rounded-full"
              style={{ backgroundColor: GOLD }}
              aria-hidden
            />
            Waga (kg)
          </span>
          <span className="inline-flex items-center gap-2" style={{ color: GREEN }}>
            <span
              className="h-1 w-4 rounded-full"
              style={{ backgroundColor: GREEN }}
              aria-hidden
            />
            Pas (cm)
          </span>
        </div>
        <div
          className="flex flex-wrap justify-end gap-1.5"
          role="tablist"
          aria-label="Zakres wykresu wagi i pasa"
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
                  "rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                  active
                    ? "bg-[var(--gym-gold)] text-black"
                    : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white/80",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {view.empty ? (
        <p className="text-xs text-white/40">Brak pomiarów w tym zakresie.</p>
      ) : (
        <div className="space-y-1">
          {hasWeights ? (
            <SeriesChart
              title="Waga"
              points={view.weights}
              color={GOLD}
              unit="kg"
              todayTs={view.todayTs}
              xDomain={view.xDomain}
              xTicks={view.xTicks}
              minSpan={1}
              tickDigits={(step) => (step < 1 ? 1 : 0)}
              showXAxis={!hasWaists}
            />
          ) : null}
          {hasWaists ? (
            <SeriesChart
              title="Pas"
              points={view.waists}
              color={GREEN}
              unit="cm"
              todayTs={view.todayTs}
              xDomain={view.xDomain}
              xTicks={view.xTicks}
              minSpan={4}
              tickDigits={(step) => (step < 1 ? 1 : 0)}
              showXAxis
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
