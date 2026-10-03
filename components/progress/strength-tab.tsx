"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Gauge,
  Trophy,
} from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { MiniSparkline } from "@/components/home/mini-sparkline";
import type {
  ProgressExerciseRow,
  ProgressHubData,
} from "@/lib/progress-hub";
import { exerciseProgressKey } from "@/lib/progress-tabs";
import { cn } from "@/lib/utils";

function formatDayMonth(iso: string) {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

function formatKg(n: number) {
  return `${new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0,
  }).format(Math.round(n))} kg`;
}

function formatReps(n: number) {
  return `${new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0,
  }).format(Math.round(n))} powt.`;
}

function formatMetric(n: number, metric: ProgressExerciseRow["metric"]) {
  return metric === "reps" ? formatReps(n) : formatKg(n);
}

function cwiczeniaGenitive(n: number): string {
  if (n === 1) return "ćwiczenia";
  return "ćwiczeń";
}

function volumeHeadline(
  counts: { up: number; flat: number; down: number },
  compared: number,
): string {
  if (compared <= 0) return "Za mało danych do porównania";
  if (counts.down > 0 && counts.down >= counts.up) {
    return `Spadek w ${counts.down} z ${compared} ${cwiczeniaGenitive(compared)}`;
  }
  if (counts.up > 0 && counts.up > counts.down) {
    return `Wzrost w ${counts.up} z ${compared} ${cwiczeniaGenitive(compared)}`;
  }
  if (counts.flat === compared) {
    return compared === 1
      ? "Stabilnie w 1 ćwiczeniu"
      : `Stabilnie w ${compared} ${cwiczeniaGenitive(compared)}`;
  }
  return `Mieszany trend w ${compared} ${cwiczeniaGenitive(compared)}`;
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

  const rightValue =
    ex.status === "pending" ? (
      <span className="font-metric text-lg text-white/30">—</span>
    ) : (
      <span className="font-metric text-[17px] tabular-nums text-white">
        {formatMetric(ex.lastVolumeKg, ex.metric)}
      </span>
    );

  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.02]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-white">{ex.name}</p>
        <p className="mt-0.5 text-[11px]">{sub}</p>
      </div>

      {ex.status === "compare" && ex.spark.length >= 2 ? (
        <div className="w-12 shrink-0">
          <MiniSparkline
            values={ex.spark.slice(-6)}
            color={
              ex.trend === "down"
                ? "#fb7185"
                : ex.trend === "up"
                  ? "#34d399"
                  : "#a3a3a3"
            }
            className="h-7 w-full"
          />
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-1.5">
        {rightValue}
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

export function StrengthTab({ data }: { data: ProgressHubData["strength"] }) {
  const { maxes, volumeCounts, volumeComparedCount, planGroups, intensity } = data;
  const [maxesOpen, setMaxesOpen] = useState(false);

  const headline = useMemo(
    () => volumeHeadline(volumeCounts, volumeComparedCount),
    [volumeCounts, volumeComparedCount],
  );
  const intensityTitle = useMemo(
    () => intensityHeadline(intensity),
    [intensity],
  );

  const newestMax = maxes.find((m) => m.isNew) ?? maxes[0] ?? null;

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <div className="app-card flex items-center gap-3 px-3.5 py-3.5">
          <button
            type="button"
            onClick={() => setMaxesOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--neon-rgb),0.12)] text-[var(--gym-gold)]">
              <Trophy className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-white">
                Moje maxy
              </span>
              <span className="mt-0.5 block text-[11px] text-white/40">
                e1RM i max powtórzeń (masa ciała)
              </span>
            </span>
          </button>
          {newestMax ? (
            <Link
              href={`/progress/exercises/${exerciseProgressKey(newestMax.name)}`}
              className="inline-flex h-9 shrink-0 items-center rounded-xl border border-white/15 bg-white/[0.04] px-3 text-[12px] font-semibold text-white/85"
            >
              + Nowy max
            </Link>
          ) : (
            <span className="inline-flex h-9 shrink-0 items-center rounded-xl border border-white/12 px-3 text-[12px] font-semibold text-white/35">
              + Nowy max
            </span>
          )}
        </div>

        {maxesOpen ? (
          maxes.length === 0 ? (
            <div className="app-card px-4 py-6 text-center text-sm text-white/45">
              Zaliczone serie (także bez ciężaru) pojawią się tu jako maxy.
            </div>
          ) : (
            <ul className="overflow-hidden app-panel divide-y divide-white/[0.06]">
              {maxes.map((m) => (
                <li key={`${m.kind}-${m.name}`}>
                  <Link
                    href={`/progress/exercises/${exerciseProgressKey(m.name)}`}
                    className="flex items-center gap-3 px-3.5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {m.name}
                        </p>
                        {m.isNew ? (
                          <span className="shrink-0 rounded-md bg-[var(--gym-gold)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--gym-gold)]">
                            nowy
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[11px] text-white/40">
                        {m.kind === "bodyweight"
                          ? `masa ciała · ${formatDayMonth(m.date)}`
                          : `${m.bestWeight} kg × ${m.bestReps} · ${formatDayMonth(m.date)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <AnimatedMetric
                        value={m.kind === "bodyweight" ? m.bestReps : m.bestE1rm}
                        decimals={m.kind === "bodyweight" ? 0 : 1}
                        className="text-xl text-white"
                      />
                      <p className="text-[10px] uppercase tracking-wider text-white/35">
                        {m.kind === "bodyweight" ? "powt." : "e1RM"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/35 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          Objętość z ostatnich 6 treningów
        </p>
        <p className="mt-2 text-[22px] font-semibold leading-snug tracking-tight text-white">
          {headline}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {(
            [
              {
                n: volumeCounts.up,
                label: "rośnie",
                Icon: ArrowUpRight,
                tone: "text-emerald-400",
                border: "border-emerald-400/25",
              },
              {
                n: volumeCounts.flat,
                label: "stoi",
                Icon: ArrowRight,
                tone: "text-white/50",
                border: "border-white/10",
              },
              {
                n: volumeCounts.down,
                label: "spada",
                Icon: ArrowDownRight,
                tone: "text-rose-400",
                border: "border-rose-400/25",
              },
            ] as const
          ).map(({ n, label, Icon, tone, border }) => (
            <div
              key={label}
              className={cn(
                "rounded-xl border bg-black/35 px-2 py-2.5 text-center",
                border,
              )}
            >
              <div className={cn("flex items-center justify-center gap-1", tone)}>
                <AnimatedMetric value={n} className={cn("text-2xl", tone)} />
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </div>
              <p className={cn("mt-1 text-[11px]", tone)}>{label}</p>
            </div>
          ))}
        </div>

        <p className="mt-3.5 text-[11px] leading-relaxed text-white/40">
          Objętość = powtórzenia × kg × serie w treningu.
        </p>
      </section>

      <section className="app-card space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--neon-rgb),0.12)] text-[var(--gym-gold)]">
            <Gauge className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Intensywność · RIR / RPE / tempo
            </p>
            <p className="mt-1.5 text-[17px] font-semibold leading-snug tracking-tight text-white">
              {intensityTitle}
            </p>
          </div>
          {intensity.rirSpark.length >= 2 ? (
            <div className="w-14 shrink-0 pt-1">
              <MiniSparkline
                values={intensity.rirSpark}
                color={
                  intensity.rirTrend === "down"
                    ? "#fb7185"
                    : intensity.rirTrend === "up"
                      ? "#34d399"
                      : "#a3a3a3"
                }
                className="h-8 w-full"
              />
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-black/35 px-2 py-2.5 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
              Śr. RIR
            </p>
            <p className="mt-1 font-metric text-2xl tabular-nums text-white">
              {intensity.avgRir != null ? (
                <AnimatedMetric value={intensity.avgRir} decimals={1} />
              ) : (
                "—"
              )}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/35 px-2 py-2.5 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
              Śr. RPE
            </p>
            <p className="mt-1 font-metric text-2xl tabular-nums text-white">
              {intensity.avgRpe != null ? (
                <AnimatedMetric value={intensity.avgRpe} decimals={1} />
              ) : (
                "—"
              )}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/35 px-2 py-2.5 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
              Twarde serie
            </p>
            <p className="mt-1 font-metric text-2xl tabular-nums text-white">
              {intensity.hardSetPct != null ? (
                <>
                  <AnimatedMetric value={intensity.hardSetPct} decimals={0} />
                  <span className="text-sm text-white/35">%</span>
                </>
              ) : (
                "—"
              )}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 text-[11px] leading-relaxed text-white/45">
          {intensity.targetComparedCount > 0 ? (
            <p>
              vs plan: {intensity.targetHitPct ?? 0}% w celu
              {intensity.harderThanPlanCount > 0
                ? ` · ${intensity.harderThanPlanCount}× ciężej`
                : ""}
              {intensity.easierThanPlanCount > 0
                ? ` · ${intensity.easierThanPlanCount}× luźniej`
                : ""}
            </p>
          ) : (
            <p>Twarde serie = RIR ≤ 1 lub RPE ≥ 8 (ostatnie 6 treningów).</p>
          )}
          {intensity.temposUsed.length > 0 ? (
            <p>
              Tempo z planu: {intensity.temposUsed.join(" · ")}
              {intensity.tempoExercisePct != null
                ? ` · w ${intensity.tempoExercisePct}% ćw.`
                : ""}
            </p>
          ) : (
            <p>Tempo z planu pojawi się tu, gdy ustawisz je przy ćwiczeniach.</p>
          )}
        </div>
      </section>

      <section className="space-y-5">
        {planGroups.length === 0 ? (
          <div className="app-card px-4 py-8 text-center text-sm text-white/45">
            Ustaw plan treningowy albo zalicz pierwsze serie.
          </div>
        ) : (
          planGroups.map((group, idx) => (
            <div key={group.planId} className="space-y-2.5">
              <SectionLabel
                index={idx + 1}
                title={group.planName}
                trailing={`${group.exercises.length} ćw.`}
                titleTone="white"
              />
              <div className="overflow-hidden app-panel divide-y divide-white/[0.06]">
                {group.exercises.map((ex) => (
                  <ExerciseRow key={`${group.planId}-${ex.name}`} ex={ex} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
