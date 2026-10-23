"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Gauge,
  Trophy,
} from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { MiniSparkline } from "@/components/home/mini-sparkline";
import { MuscleBalancePanel } from "@/components/progress/muscle-balance-panel";
import {
  StrengthForecastCard,
  StrengthTrendCard,
} from "@/components/progress/strength-trend-card";
import {
  CollapsibleCard,
  EmptyNote,
  Explainer,
  ProgressSection,
  StatTile,
  Surface,
} from "@/components/progress/progress-ui";
import type { ProgressIntelligence } from "@/lib/analytics";
import { formatDayMonth } from "@/lib/progress-format";
import type { ProgressExerciseRow, ProgressHubData } from "@/lib/progress-hub";
import { exerciseProgressKey } from "@/lib/progress-tabs";
import { cn } from "@/lib/utils";

function formatMetric(n: number, metric: ProgressExerciseRow["metric"]) {
  const v = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
  return metric === "reps" ? `${v} powt.` : `${v} kg`;
}

function ExerciseRow({ ex }: { ex: ProgressExerciseRow }) {
  const href = `/progress/exercises/${exerciseProgressKey(ex.name)}`;

  let sub: ReactNode = null;
  if (ex.status === "pending") {
    sub = <span className="text-white/35">jeszcze nie robione</span>;
  } else if (ex.status === "first" && ex.firstDate) {
    sub = (
      <span className="text-white/40">
        pierwszy trening {formatDayMonth(ex.firstDate)}
      </span>
    );
  } else if (ex.status === "compare" && ex.volumeDeltaKg != null) {
    const neg = ex.volumeDeltaKg < 0;
    const pos = ex.volumeDeltaKg > 0;
    const deltaAbs = Math.abs(Math.round(ex.volumeDeltaKg));
    const unit = ex.metric === "reps" ? " powt." : " kg";
    const pct =
      ex.volumeDeltaPercent != null
        ? ` (${ex.volumeDeltaPercent > 0 ? "+" : ""}${ex.volumeDeltaPercent}%)`
        : "";
    sub = (
      <span
        className={cn(
          pos && "text-emerald-400",
          neg && "text-rose-400",
          !pos && !neg && "text-white/45",
        )}
      >
        {pos ? "+" : neg ? "−" : ""}
        {deltaAbs}
        {unit}
        {pct}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="grid grid-cols-[1fr_auto] items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-white/[0.02] sm:grid-cols-[1fr_3rem_auto]"
    >
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold leading-snug text-white">
          {ex.name}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug">{sub}</p>
      </div>

      {ex.status === "compare" && ex.spark.length >= 2 ? (
        <div className="hidden w-12 shrink-0 sm:block">
          <MiniSparkline
            values={ex.spark.slice(-6)}
            color={
              ex.trend === "down"
                ? "#fb7185"
                : ex.trend === "up"
                  ? "#34d399"
                  : "#a3a3a3"
            }
            className="h-6 w-full"
          />
        </div>
      ) : (
        <span className="hidden sm:block" aria-hidden />
      )}

      <div className="flex shrink-0 items-center justify-end gap-1">
        {ex.status === "pending" ? (
          <span className="font-metric text-[15px] text-white/30">—</span>
        ) : (
          <span className="font-metric text-[14px] tabular-nums text-white">
            {formatMetric(ex.lastVolumeKg, ex.metric)}
          </span>
        )}
        {ex.status === "compare" ? (
          ex.trend === "down" ? (
            <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" aria-hidden />
          ) : ex.trend === "up" ? (
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
          ) : (
            <ArrowRight className="h-3.5 w-3.5 text-white/30" aria-hidden />
          )
        ) : null}
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
        : "#a3a3a3";

  return (
    <ProgressSection title="Intensywność" trailing="ostatnie 6 treningów">
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
    </ProgressSection>
  );
}

function RecordsCard({ maxes }: { maxes: ProgressHubData["strength"]["maxes"] }) {
  const newest = maxes.find((m) => m.isNew) ?? maxes[0] ?? null;

  if (maxes.length === 0) {
    return (
      <EmptyNote>
        Zaliczone serie (także bez ciężaru) pojawią się tu jako rekordy.
      </EmptyNote>
    );
  }

  return (
    <CollapsibleCard
      title="Rekordy"
      icon={<Trophy className="h-3.5 w-3.5" aria-hidden />}
      summary={
        newest
          ? `${maxes.length} · ostatni: ${newest.name}`
          : `${maxes.length}`
      }
    >
      <ul className="divide-y divide-white/[0.06]">
        {maxes.map((m) => (
          <li key={`${m.kind}-${m.name}`}>
            <Link
              href={`/progress/exercises/${exerciseProgressKey(m.name)}`}
              className="grid grid-cols-[1fr_auto] items-center gap-2.5 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[13px] font-semibold leading-snug text-white">
                    {m.name}
                  </p>
                  {m.isNew ? (
                    <span className="shrink-0 rounded-md bg-[var(--gym-gold)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--gym-gold)]">
                      nowy
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-white/40">
                  {m.kind === "bodyweight"
                    ? `masa ciała · ${formatDayMonth(m.date)}`
                    : `${m.bestWeight} kg × ${m.bestReps} · ${formatDayMonth(m.date)}`}
                </p>
              </div>
              <div className="min-w-[3.5rem] text-right">
                <AnimatedMetric
                  value={m.kind === "bodyweight" ? m.bestReps : m.bestE1rm}
                  decimals={m.kind === "bodyweight" ? 0 : 1}
                  className="text-[16px] leading-none text-white"
                />
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-white/35">
                  {m.kind === "bodyweight" ? "powt." : "e1RM"}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </CollapsibleCard>
  );
}

function CountChips({
  counts,
}: {
  counts: { up: number; flat: number; down: number };
}) {
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span className="inline-flex items-center gap-0.5 text-emerald-400">
        <ArrowUpRight className="h-3 w-3" aria-hidden />
        {counts.up}
      </span>
      <span className="inline-flex items-center gap-0.5 text-white/50">
        <ArrowRight className="h-3 w-3" aria-hidden />
        {counts.flat}
      </span>
      <span className="inline-flex items-center gap-0.5 text-rose-400">
        <ArrowDownRight className="h-3 w-3" aria-hidden />
        {counts.down}
      </span>
    </span>
  );
}

/**
 * Siła: trend → ćwiczenia wg planu → rekordy → intensywność → balans → prognoza.
 * Liczniki rośnie/stoi/spada (dawny osobny hero) są teraz w nagłówku listy ćwiczeń.
 */
export function StrengthTab({
  data,
  intelligence,
}: {
  data: ProgressHubData["strength"];
  intelligence: ProgressIntelligence;
}) {
  const { maxes, volumeCounts, volumeComparedCount, planGroups, intensity } = data;

  return (
    <div className="space-y-3.5">
      <StrengthTrendCard velocity={intelligence.velocity} />

      <ProgressSection
        title="Ćwiczenia wg planu"
        trailing={
          volumeComparedCount > 0 ? <CountChips counts={volumeCounts} /> : undefined
        }
      >
        {planGroups.length === 0 ? (
          <EmptyNote>Ustaw plan treningowy albo zalicz pierwsze serie.</EmptyNote>
        ) : (
          <div className="space-y-2">
            {planGroups.map((group, idx) => (
              <CollapsibleCard
                key={group.planId}
                title={group.planName}
                summary={`${group.exercises.length} ćw.`}
                defaultOpen={idx === 0}
              >
                <div className="divide-y divide-white/[0.06]">
                  {group.exercises.map((ex) => (
                    <ExerciseRow key={`${group.planId}-${ex.name}`} ex={ex} />
                  ))}
                </div>
              </CollapsibleCard>
            ))}
            <Explainer>
              <p>
                Strzałka porównuje objętość ostatniego treningu z poprzednim.
                Objętość = powtórzenia × kg × serie.
              </p>
            </Explainer>
          </div>
        )}
      </ProgressSection>

      <RecordsCard maxes={maxes} />

      <IntensityCard intensity={intensity} />

      <MuscleBalancePanel
        muscle={intelligence.muscle}
        stagnation={intelligence.stagnation}
      />

      <StrengthForecastCard predictions={intelligence.predictions} />
    </div>
  );
}
