"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Gauge,
} from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { MiniSparkline } from "@/components/home/mini-sparkline";
import { MuscleBalancePanel } from "@/components/progress/muscle-balance-panel";
import { StrengthTrendCard } from "@/components/progress/strength-trend-card";
import {
  CollapsibleCard,
  EmptyNote,
  Explainer,
  ProgressSection,
  SegmentedControl,
  StatTile,
  Surface,
} from "@/components/progress/progress-ui";
import type { ProgressIntelligence } from "@/lib/analytics";
import { formatDayMonth } from "@/lib/progress-format";
import type { ProgressExerciseRow, ProgressHubData } from "@/lib/progress-hub";
import { exerciseProgressKey } from "@/lib/progress-tabs";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";
import { cn } from "@/lib/utils";

type ExerciseMetric = "e1rm" | "volume" | "record";

type ExerciseDisplay = {
  source: ProgressExerciseRow;
  status: "pending" | "first" | "compare";
  trend: "up" | "flat" | "down";
  hasTrend: boolean;
  valueLabel: string;
  subtitle: string;
  spark: number[];
  isNewRecord: boolean;
};

function exerciseDisplay(
  exercise: ProgressExerciseRow,
  metric: ExerciseMetric,
  period: "7" | "30" | "90",
  today: string,
): ExerciseDisplay {
  const cutoff = addCalendarDays(today, -(Number(period) - 1));
  const sessions = exercise.history.filter((point) => point.date >= cutoff);
  const weighted = exercise.metric === "kg";
  const noData: ExerciseDisplay = {
    source: exercise,
    status: "pending",
    trend: "flat",
    hasTrend: false,
    valueLabel: "—",
    subtitle: "Brak treningów w tym okresie",
    spark: [],
    isNewRecord: false,
  };
  if (!sessions.length) return noData;

  if (metric === "record") {
    const best = sessions.reduce((current, point) => {
      const value = weighted ? point.bestE1rm : point.bestReps;
      const bestValue = weighted ? current.bestE1rm : current.bestReps;
      return value > bestValue ? point : current;
    });
    const label = weighted
      ? `${best.bestWeight} kg × ${best.bestReps}`
      : `${best.bestReps} powt.`;
    const newCutoff = addCalendarDays(today, -21);
    const orderedValues = sessions.map((point) => weighted ? point.bestE1rm : point.bestReps);
    const previous = orderedValues.length > 1 ? orderedValues[orderedValues.length - 2]! : null;
    const latest = orderedValues[orderedValues.length - 1]!;
    const delta = sessions.length >= 3 && previous != null && previous > 0 ? ((latest - previous) / previous) * 100 : null;
    const trend = delta == null || Math.abs(delta) < 3 ? "flat" : delta > 0 ? "up" : "down";
    return {
      source: exercise,
      status: sessions.length > 1 ? "compare" : "first",
      trend,
      hasTrend: delta != null,
      valueLabel: label,
      subtitle: `Najlepszy wynik · ${formatDayMonth(best.date)}`,
      spark: [],
      isNewRecord: best.date >= newCutoff,
    };
  }

  const values = sessions.map((point) =>
    metric === "e1rm" ? (weighted ? point.bestE1rm : point.bestReps) :
      (weighted ? point.volumeKg : point.totalReps),
  ).filter((value) => value > 0);
  if (!values.length) return noData;
  const latest = values[values.length - 1]!;
  const previous = values.length > 1 ? values[values.length - 2]! : null;
  const deltaPercent = sessions.length >= 3 && previous != null && previous > 0
    ? Math.round(((latest - previous) / previous) * 100)
    : null;
  const trend = deltaPercent == null || Math.abs(deltaPercent) < 3
    ? "flat"
    : deltaPercent > 0 ? "up" : "down";
  const label = metric === "e1rm" && weighted ? `${latest} kg` : `${Math.round(latest)} ${weighted ? "kg" : "powt."}`;
  const subtitle = deltaPercent == null
    ? `Za mało danych do trendu. Potrzeba 3 sesji · ${sessions.length}/3`
    : `${deltaPercent > 0 ? "+" : ""}${deltaPercent}% · ${sessions.length} sesji`;

  return {
    source: exercise,
    status: values.length > 1 ? "compare" : "first",
    trend,
    hasTrend: deltaPercent != null,
    valueLabel: label,
    subtitle,
    spark: values.slice(-6),
    isNewRecord: false,
  };
}

function ExerciseRow({ display, period }: { display: ExerciseDisplay; period: "7" | "30" | "90" }) {
  const { source: exercise } = display;
  const href = `/progress/exercises/${exerciseProgressKey(exercise.name)}?okres=${period}`;
  return (
    <Link href={href} className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-2.5 px-3.5 py-3 transition-colors hover:bg-white/[0.02] sm:grid-cols-[1fr_3.5rem_auto]">
      <div className="min-w-0">
        <p className="line-clamp-2 text-[15px] font-semibold leading-5 text-white">{exercise.name}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--gym-text-secondary)]">{display.subtitle}</p>
      </div>
      {display.spark.length >= 2 ? (
        <div className="hidden w-12 shrink-0 sm:block">
          <MiniSparkline values={display.spark} color={display.trend === "up" ? "#3ecf72" : "#9a9182"} className="h-5 w-full" />
        </div>
      ) : <span className="hidden sm:block" aria-hidden />}
      <div className="flex shrink-0 items-center justify-end gap-1">
        <span className={cn("font-metric text-[14px] tabular-nums text-white", display.valueLabel.length > 12 && "max-w-28 text-right text-[12px]")}>{display.valueLabel}</span>
        {display.isNewRecord ? <span className="rounded-full border border-[var(--gym-gold)]/45 px-2 py-0.5 text-[11px] font-semibold text-[var(--gym-gold)]">Nowy</span> : null}
        {display.hasTrend ? display.trend === "up" ? <ArrowUpRight className="h-3.5 w-3.5 text-[var(--gym-success)]" aria-hidden /> : display.trend === "down" ? <ArrowDownRight className="h-3.5 w-3.5 text-[var(--gym-text-secondary)]" aria-hidden /> : <ArrowRight className="h-3.5 w-3.5 text-[var(--gym-text-secondary)]" aria-hidden /> : null}
      </div>
    </Link>
  );
}

function intensityHeadline(data: ProgressHubData["strength"]["intensity"]): string {
  if (data.sessionsWithIntensity <= 0) {
    return "Zapisuj RIR (W zapasie) przy seriach — tu zobaczysz trend";
  }
  if (data.avgRir != null && data.rirTrend === "down") {
    return "Ostatnie serie są twardsze (mniej zapasu RIR)";
  }
  if (data.avgRir != null && data.rirTrend === "up") {
    return "Ostatnie serie są lżejsze (więcej zapasu RIR)";
  }
  if (data.targetHitPct != null) {
    return `RIR zgodny z planem w ${data.targetHitPct}% porównań`;
  }
  if (data.avgRir != null) {
    return `Średni RIR z ostatnich treningów: ${data.avgRir}`;
  }
  if (data.avgRpe != null) {
    return `Średnie RPE z ostatnich treningów: ${data.avgRpe}`;
  }
  return "Za mało wpisów RIR/RPE do trendu";
}

function IntensityCard({
  intensity,
}: {
  intensity: ProgressHubData["strength"]["intensity"];
}) {
  const title = useMemo(() => intensityHeadline(intensity), [intensity]);
  const sparkColor =
    intensity.rirTrend === "down"
      ? "#fb7185"
      : intensity.rirTrend === "up"
        ? "#34d399"
        : "#9a9182";

  return (
    <Surface className="space-y-3">
        <div className="flex items-start gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--neon-rgb),0.12)] text-[var(--gym-gold)]">
            <Gauge className="h-3.5 w-3.5" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 pt-1 text-[13px] font-semibold leading-snug text-white">
            {title}
          </p>
          {intensity.rirSpark.length >= 2 ? (
            <div className="w-12 shrink-0 pt-0.5">
              <MiniSparkline
                values={intensity.rirSpark}
                color={sparkColor}
                className="h-7 w-full"
              />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label="Śr. RIR"
            value={
              intensity.avgRir != null ? (
                <AnimatedMetric value={intensity.avgRir} decimals={1} />
              ) : (
                "—"
              )
            }
          />
          <StatTile
            label="Śr. RPE"
            value={
              intensity.avgRpe != null ? (
                <AnimatedMetric value={intensity.avgRpe} decimals={1} />
              ) : (
                "—"
              )
            }
          />
          <StatTile
            label="Twarde serie"
            value={
              intensity.hardSetPct != null ? (
                <>
                  <AnimatedMetric value={intensity.hardSetPct} decimals={0} />
                  <span className="text-[12px] text-white/35">%</span>
                </>
              ) : (
                "—"
              )
            }
          />
        </div>

        {intensity.targetComparedCount > 0 ? (
          <p className="text-[12px] leading-snug text-white/55">
            Względem planu: {intensity.targetHitPct ?? 0}% w celu
            {intensity.harderThanPlanCount > 0
              ? ` · ${intensity.harderThanPlanCount}× ciężej`
              : ""}
            {intensity.easierThanPlanCount > 0
              ? ` · ${intensity.easierThanPlanCount}× luźniej`
              : ""}
          </p>
        ) : null}

        <Explainer label="Szczegóły i definicje">
          <p>Twarde serie = RIR ≤ 1 lub RPE ≥ 8.</p>
          {intensity.temposUsed.length > 0 ? (
            <p>
              Tempo z planu: {intensity.temposUsed.join(" · ")}
              {intensity.tempoExercisePct != null
                ? ` · w ${intensity.tempoExercisePct}% ćwiczeń`
                : ""}
            </p>
          ) : (
            <p>Tempo z planu pojawi się tu, gdy ustawisz je przy ćwiczeniach.</p>
          )}
        </Explainer>
    </Surface>
  );
}

/**
 * Siła: podsumowanie, lista ćwiczeń, balans i zwijana intensywność.
 */
export function StrengthTab({
  data,
  intelligence,
  period,
  onPeriodChange,
}: {
  data: ProgressHubData["strength"];
  intelligence: ProgressIntelligence;
  period: "7" | "30" | "90";
  onPeriodChange: (period: "7" | "30" | "90") => void;
}) {
  const { planGroups, intensity } = data;
  const [filter, setFilter] = useState<"all" | "up" | "down" | "flat">("all");
  const [displayMetric, setDisplayMetric] = useState<ExerciseMetric>("e1rm");
  const today = calendarDateKey();
  const periodGroups = planGroups
    .map((group) => ({
      ...group,
      exercises: group.exercises.map((exercise) => exerciseDisplay(exercise, displayMetric, period, today)),
    }));
  const eligibleGroups = periodGroups
    .map((group) => ({ ...group, exercises: group.exercises.filter((exercise) => exercise.status !== "pending") }))
    .filter((group) => group.exercises.length > 0);
  const visibleGroups = periodGroups
    .map((group) => ({ ...group, exercises: filter === "all" ? group.exercises : group.exercises.filter((exercise) => exercise.status !== "pending" && exercise.hasTrend && exercise.trend === filter) }))
    .filter((group) => group.exercises.length > 0);
  const exerciseCount = eligibleGroups.reduce((count, group) => count + group.exercises.length, 0);
  const trendCounts = eligibleGroups.reduce(
    (counts, group) => {
      for (const exercise of group.exercises) {
        if (exercise.hasTrend) counts[exercise.trend] += 1;
      }
      return counts;
    },
    { up: 0, down: 0, flat: 0 },
  );

  return (
    <div className="space-y-5">
      <StrengthTrendCard velocity={intelligence.velocity} period={period} onPeriodChange={onPeriodChange} />

      <Link
        href="/progress/objetosc"
        className="app-panel flex items-center justify-between px-3.5 py-3 text-[14px] font-semibold text-white"
      >
        Objętość tygodniowa i regeneracja mięśni
        <span aria-hidden className="text-white/45">›</span>
      </Link>
      <Link
        href="/progress/przeglad-planu"
        className="app-panel flex items-center justify-between px-3.5 py-3 text-[14px] font-semibold text-white"
      >
        Przegląd planu — propozycje zmian
        <span aria-hidden className="text-white/45">›</span>
      </Link>

      <ProgressSection
        title="Ćwiczenia"
        trailing="ostatnie sesje"
      >
        {planGroups.length === 0 ? (
          <EmptyNote>Ustaw plan treningowy albo zalicz pierwsze serie.</EmptyNote>
        ) : (
          <div className="space-y-2">
            <SegmentedControl
              options={[{ id: "e1rm", label: "e1RM" }, { id: "volume", label: "Tonaż" }, { id: "record", label: "Rekord" }] as const}
              value={displayMetric}
              onChange={setDisplayMetric}
              ariaLabel="Metryka ćwiczeń"
            />
            <div role="group" aria-label="Filtr ćwiczeń" className="flex gap-2 overflow-x-auto pb-1">
              {([
                { id: "all", label: "Wszystkie", count: exerciseCount },
                { id: "up", label: "Rośnie", count: trendCounts.up },
                { id: "down", label: "Spada", count: trendCounts.down },
                { id: "flat", label: "Stoją", count: trendCounts.flat },
              ] as const).map((option) => (
                <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)} className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium ${filter === option.id ? "border-[var(--gym-gold)]/60 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]" : "border-[var(--gym-border-gold)] text-white/80"}`}>
                  {option.label} <span className="tabular-nums text-[var(--gym-text-secondary)]">{option.count}</span>
                </button>
              ))}
            </div>
            {visibleGroups.length === 0 ? <EmptyNote>Brak ćwiczeń w tej grupie w wybranym okresie.</EmptyNote> : visibleGroups.map((group, idx) => (
              <CollapsibleCard
                key={group.planId}
                title={group.planName}
                summary={`${group.exercises.length} ćw.`}
                defaultOpen={idx === 0}
              >
                <div className="divide-y divide-white/[0.06]">
                  {group.exercises.map((ex) => (
                    <ExerciseRow key={`${group.planId}-${ex.source.name}`} display={ex} period={period} />
                  ))}
                </div>
              </CollapsibleCard>
            ))}
            <Explainer>
              <p>
                Tonaż to suma powtórzeń × ciężar we wszystkich zaliczonych seriach. e1RM to szacowany ciężar na jedno powtórzenie; przy ćwiczeniach z masą ciała porównujemy liczbę powtórzeń.
              </p>
            </Explainer>
          </div>
        )}
      </ProgressSection>

      <MuscleBalancePanel muscle={intelligence.muscle} />

      <CollapsibleCard
        title="Intensywność · ostatnie 6 treningów"
        summary={`RIR śr. ${intensity.avgRir ?? "—"} · RPE śr. ${intensity.avgRpe ?? "—"}`}
        icon={<Gauge className="h-3.5 w-3.5" aria-hidden />}
      >
        <IntensityCard intensity={intensity} />
      </CollapsibleCard>

    </div>
  );
}
