"use client";

import { BRAND_GOLD } from "@/lib/brand-colors";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type {
  ExerciseCompareKind,
  ExercisePeriodCompare,
  ExercisePeriodCompares,
  ExercisePeriodMetric,
  ExercisePeriodOutcome,
} from "@/lib/exercise-period-compare";
import {
  MAX_RANGE_DAYS,
  MIN_RELIABLE_SESSIONS,
  buildExerciseRangeCompare,
  formatPeriodDeltaPct,
  normalizeCompareRange,
  shortPeriodAxisLabel,
} from "@/lib/exercise-period-compare";
import type {
  ExerciseMetricKind,
  ExerciseProgressPoint,
} from "@/lib/exercise-progress";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";

const tooltipStyle = {
  backgroundColor: "rgba(12, 12, 14, 0.96)",
  border: "1px solid rgba(var(--neon-rgb),0.28)",
  borderRadius: "14px",
  fontSize: "12px",
  color: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
  padding: "10px 12px",
};

const TABS: { id: ExerciseCompareKind; label: string }[] = [
  { id: "week", label: "Tydzień" },
  { id: "month", label: "Miesiąc" },
  { id: "quarter", label: "3 mies." },
  { id: "year", label: "Rok" },
  { id: "range", label: "Własny" },
];

/** Podpis pod wykresem — co oznaczają słupki w danym trybie. */
const BAR_CAPTION: Record<ExerciseCompareKind, string> = {
  week: "śr. e1RM / objętość w tygodniu",
  month: "śr. e1RM / objętość w miesiącu",
  quarter: "śr. e1RM / objętość w kwartale kalendarzowym (3 mies.)",
  year: "śr. e1RM / objętość w roku",
  range: "śr. e1RM / objętość w tygodniach wybranego i poprzedniego okresu",
};

function outcomeTone(o: ExercisePeriodOutcome): string {
  if (o === "progress") return "text-emerald-300";
  if (o === "regress") return "text-[var(--gym-text-secondary)]";
  return "text-[var(--gym-text-secondary)]";
}

function barFill(o: ExercisePeriodOutcome): string {
  if (o === "progress") return "#34d399";
  if (o === "regress") return "#9a9182";
  return BRAND_GOLD;
}

function OutcomeIcon({ outcome }: { outcome: ExercisePeriodOutcome }) {
  if (outcome === "progress") {
    return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" aria-hidden />;
  }
  if (outcome === "regress") {
    return <ArrowDownRight className="h-3.5 w-3.5 text-[var(--gym-text-secondary)]" aria-hidden />;
  }
  return <Minus className="h-3.5 w-3.5 text-white/50" aria-hidden />;
}

function VerdictBadge({ compare }: { compare: ExercisePeriodCompare }) {
  const tone =
    compare.verdict === "progress"
      ? "bg-emerald-400/15 text-emerald-300"
      : compare.verdict === "regress"
        ? "bg-white/[0.06] text-[var(--gym-text-secondary)]"
        : "bg-white/[0.08] text-white/55";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      {compare.verdictLabel}
    </span>
  );
}

function PercentBar({ metric }: { metric: ExercisePeriodMetric }) {
  const pct = metric.deltaPct;
  const width = pct == null ? 0 : Math.min(100, Math.abs(pct));
  const fill =
    metric.outcome === "progress"
      ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
      : metric.outcome === "regress"
        ? "bg-gradient-to-r from-neutral-600 to-neutral-400"
        : "bg-gradient-to-r from-[var(--gym-gold-deep)] to-[var(--gym-gold)]";

  return (
    <li className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium text-white/80">
            {metric.label}
          </p>
          <p className="mt-0.5 text-[10px] text-white/50">
            {metric.previous != null
              ? `${metric.previous.toLocaleString("pl-PL")}${metric.unit ? ` ${metric.unit}` : ""}`
              : "—"}
            <span className="mx-1 text-white/50">→</span>
            {metric.current != null
              ? `${metric.current.toLocaleString("pl-PL")}${metric.unit ? ` ${metric.unit}` : ""}`
              : "—"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <OutcomeIcon outcome={metric.outcome} />
          <span
            className={cn(
              "font-heading text-sm tabular-nums",
              outcomeTone(metric.outcome),
            )}
          >
            {formatPeriodDeltaPct(pct)}
          </span>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={cn("h-full rounded-full", fill)}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        />
      </div>
    </li>
  );
}

function ChipList({
  title,
  metrics,
  empty,
}: {
  title: string;
  metrics: ExercisePeriodMetric[];
  empty: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
        {title}
      </p>
      {metrics.length === 0 ? (
        <p className="mt-1.5 text-[12px] text-white/50">{empty}</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {metrics.map((m) => (
            <li
              key={m.key}
              className={cn(
                "rounded-lg border px-2 py-1 text-[11px]",
                m.outcome === "progress"
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                  : "border-white/15 bg-white/[0.05] text-[var(--gym-text-secondary)]",
              )}
            >
              {m.label}{" "}
              <span className="font-metric tabular-nums">
                {formatPeriodDeltaPct(m.deltaPct)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ExercisePeriodComparePanel({
  compares,
  points,
  metric = "kg",
}: {
  compares: ExercisePeriodCompares;
  /** Punkty ćwiczenia — włączają zakładkę „Własny” (zakres dowolny). */
  points?: ExerciseProgressPoint[];
  metric?: ExerciseMetricKind;
}) {
  const [kind, setKind] = useState<ExerciseCompareKind>("week");
  const [rangeTo, setRangeTo] = useState<string>(() => calendarDateKey());
  const [rangeFrom, setRangeFrom] = useState<string>(() =>
    addCalendarDays(calendarDateKey(), -29),
  );

  const tabs = points ? TABS : TABS.filter((t) => t.id !== "range");
  const rangeValid = normalizeCompareRange(rangeFrom, rangeTo) != null;

  const compare = useMemo<ExercisePeriodCompare>(() => {
    if (kind === "range") {
      return buildExerciseRangeCompare(points ?? [], metric, rangeFrom, rangeTo);
    }
    return compares[kind];
  }, [kind, compares, points, metric, rangeFrom, rangeTo]);

  const axisKind = kind === "range" ? "week" : kind;

  const chartData = useMemo(
    () =>
      compare.series.map((s) => ({
        ...s,
        axis: shortPeriodAxisLabel(axisKind, s.key),
        fill: barFill(
          s.deltaPct == null
            ? "flat"
            : Math.abs(s.deltaPct) < 3
              ? "flat"
              : s.deltaPct > 0
                ? "progress"
                : "regress",
        ),
      })),
    [compare.series, axisKind],
  );

  const scoredMetrics = compare.metrics.filter((m) => m.outcome !== "none");

  return (
    <section className="app-card space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Porównania okresów
          </p>
          <p className="mt-1 text-sm text-white/65">
            Procentowo: co rośnie, a co spada względem poprzedniego okresu.
          </p>
        </div>
        <VerdictBadge compare={compare} />
      </div>

      <div
        className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1"
        role="tablist"
        aria-label="Okres porównania"
      >
        {tabs.map((t) => {
          const active = t.id === kind;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(t.id)}
              className={cn(
                "flex-1 rounded-lg px-1 py-2 text-[11px] font-semibold transition sm:px-2 sm:text-[12px]",
                active
                  ? "bg-[var(--gym-gold)]/20 text-[var(--gym-gold)] shadow-[0_0_0_1px_rgba(var(--neon-rgb),0.35)]"
                  : "text-white/50 hover:text-white/70",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {kind === "range" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                Od
              </span>
              <Input
                type="date"
                value={rangeFrom}
                max={rangeTo || undefined}
                onChange={(e) => setRangeFrom(e.target.value)}
                aria-label="Początek zakresu porównania"
                aria-invalid={!rangeValid}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
                Do
              </span>
              <Input
                type="date"
                value={rangeTo}
                min={rangeFrom || undefined}
                onChange={(e) => setRangeTo(e.target.value)}
                aria-label="Koniec zakresu porównania"
                aria-invalid={!rangeValid}
              />
            </label>
          </div>
          <p
            className={cn(
              "text-[11px]",
              rangeValid ? "text-white/50" : "text-[var(--gym-gold)]",
            )}
            role={rangeValid ? undefined : "alert"}
          >
            {rangeValid
              ? "Porównanie z poprzednim okresem tej samej długości."
              : `Wybierz poprawny zakres: data „od” nie późniejsza niż „do”, maks. ${MAX_RANGE_DAYS} dni.`}
          </p>
        </div>
      ) : null}

      <p className="text-[11px] text-white/50">
        {compare.currentLabel}
        <span className="mx-1.5 text-white/50">·</span>
        {compare.previousLabel}
      </p>

      {compare.lowConfidence && compare.verdict !== "insufficient" ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] text-white/55">
          Mniej niż {MIN_RELIABLE_SESSIONS} sesje w jednym z okresów — wynik
          może być przypadkowy (forma dnia, jedna słabsza sesja), traktuj go
          orientacyjnie.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <ChipList
          title="Średnio rośnie"
          metrics={compare.rising}
          empty="Brak wyraźnego wzrostu w tym okresie"
        />
        <ChipList
          title="Średnio spada"
          metrics={compare.falling}
          empty="Brak wyraźnego spadku w tym okresie"
        />
      </div>

      <div className="relative h-[200px] w-full min-w-0">
        {chartData.length < 2 ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 text-xs text-white/50">
            Potrzeba co najmniej dwóch okresów z treningami.
          </div>
        ) : (
          <ResponsiveContainer
          width="100%"
          height="100%"
          minHeight={100}
          initialDimension={{ width: 320, height: 200 }}
        >
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="axis"
                tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, _name, item) => {
                  const pct = (item?.payload as { deltaPct?: number | null })
                    ?.deltaPct;
                  return [
                    `${Number(value).toLocaleString("pl-PL")}${
                      pct != null ? ` (${formatPeriodDeltaPct(pct)})` : ""
                    }`,
                    "Wartość",
                  ];
                }}
                labelFormatter={(_, payload) => {
                  const p = payload?.[0]?.payload as
                    | { label?: string }
                    | undefined;
                  return p?.label ?? "";
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={36}>
                {chartData.map((d) => (
                  <Cell key={d.key} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="text-[10px] text-white/50">
        Słupki: {BAR_CAPTION[kind]}. Kolor: zielony = wzrost względem poprzedniego okresu, różowy =
        spadek.
      </p>

      {scoredMetrics.length ? (
        <ul className="space-y-2">
          {scoredMetrics.map((m) => (
            <PercentBar key={m.key} metric={m} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/50">
          Za mało historii, żeby policzyć procenty. Trenuj dalej — porównania
          pojawią się po kolejnym okresie.
        </p>
      )}
    </section>
  );
}
