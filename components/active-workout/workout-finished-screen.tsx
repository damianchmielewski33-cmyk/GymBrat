"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Flame, Trophy } from "lucide-react";
import { fetchWorkoutFinishContextAction } from "@/actions/workout-finish-context";
import type { SessionWeightRecord } from "@/lib/session-new-max";
import type { WorkoutExerciseState } from "@/components/workout/types";
import { bestSetsFromSession } from "@/lib/workout-session-calculations";
import { estimated1RM } from "@/lib/workout-history";
import {
  formatWeightRecordLine,
  formatWorkoutDurationPl,
  workoutFinishFooterLine,
} from "@/lib/workout-finish-format";
import { formatKgPl } from "@/lib/set-progression-suggestion";
import { SectionLabel } from "@/components/ui/section-label";
import type { ActiveCardioExtras } from "@/lib/stores/active-workout";
import { cn } from "@/lib/utils";

type WorkoutFinishedScreenProps = {
  title: string;
  elapsedSeconds: number;
  setsDone: number;
  setsTotal: number;
  volumeKg: number;
  exercises: WorkoutExerciseState[];
  weightRecords: SessionWeightRecord[];
  cardioMinutes: number;
  cardioExtras: ActiveCardioExtras;
  onCardioMinutesChange: (minutes: number) => void;
  onCardioExtrasChange: (extras: Partial<ActiveCardioExtras>) => void;
  onDone: () => void;
  onReturn: () => void;
  onClose?: () => void;
  saving?: boolean;
};

function numOrEmpty(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) && n > 0 ? String(n) : "";
}

function tonnageParts(kg: number): { value: string; unit: string } {
  const n = Math.max(0, Math.round(kg));
  return {
    value: new Intl.NumberFormat("pl-PL").format(n),
    unit: "kg",
  };
}

function BestSetStat({
  row,
}: {
  row: ReturnType<typeof bestSetsFromSession>[number];
}) {
  if (row.kind === "bodyweight") {
    return (
      <span className="whitespace-nowrap">
        {row.reps}
        <span className="font-normal text-white/40"> powt.</span>
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatKgPl(row.weight)}
      <span className="mx-0.5 font-normal text-white/35">×</span>
      {row.reps}
    </span>
  );
}

function FinishListRow({
  name,
  stat,
}: {
  name: string;
  stat: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-3.5">
      <p className="text-[14px] font-medium leading-snug text-white/90 line-clamp-2">
        {name}
      </p>
      <p className="text-right text-[14px] font-semibold text-[var(--gym-gold)]">
        {stat}
      </p>
    </li>
  );
}

export function WorkoutFinishedScreen(props: WorkoutFinishedScreenProps) {
  const {
    title,
    elapsedSeconds,
    setsDone,
    setsTotal,
    volumeKg,
    exercises,
    weightRecords,
    cardioMinutes,
    cardioExtras,
    onCardioMinutesChange,
    onCardioExtrasChange,
    onDone,
    saving,
  } = props;

  const exerciseCount = exercises.length;
  const bestSets = useMemo(
    () => bestSetsFromSession(exercises, estimated1RM),
    [exercises],
  );
  const tonnage = tonnageParts(volumeKg);

  const [mounted, setMounted] = useState(false);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [draftMinutes, setDraftMinutes] = useState(
    cardioMinutes > 0 ? cardioMinutes : 20,
  );
  const [draftDistance, setDraftDistance] = useState(
    numOrEmpty(cardioExtras.distanceKm),
  );
  const [draftHr, setDraftHr] = useState(numOrEmpty(cardioExtras.avgHr));
  const [draftCalories, setDraftCalories] = useState(
    numOrEmpty(cardioExtras.calories),
  );
  const [draftSteps, setDraftSteps] = useState(numOrEmpty(cardioExtras.steps));
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchWorkoutFinishContextAction().then((ctx) => {
      if (!cancelled) setWorkoutsThisWeek(ctx.workoutsThisWeek);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cardioMinutes > 0) setDraftMinutes(cardioMinutes);
  }, [cardioMinutes]);

  useEffect(() => {
    setDraftDistance(numOrEmpty(cardioExtras.distanceKm));
    setDraftHr(numOrEmpty(cardioExtras.avgHr));
    setDraftCalories(numOrEmpty(cardioExtras.calories));
    setDraftSteps(numOrEmpty(cardioExtras.steps));
  }, [cardioExtras]);

  function saveCardioDraft() {
    const dist = Number(String(draftDistance).replace(",", "."));
    const hr = Number(draftHr);
    const cal = Number(draftCalories);
    const steps = Number(draftSteps);
    onCardioMinutesChange(draftMinutes);
    onCardioExtrasChange({
      distanceKm: Number.isFinite(dist) && dist > 0 ? dist : null,
      avgHr: Number.isFinite(hr) && hr > 0 ? Math.round(hr) : null,
      calories: Number.isFinite(cal) && cal > 0 ? Math.round(cal) : null,
      steps: Number.isFinite(steps) && steps > 0 ? Math.round(steps) : null,
    });
    setCardioOpen(false);
  }

  const cardioSummaryBits = [
    `${cardioMinutes} min`,
    cardioExtras.distanceKm != null ? `${cardioExtras.distanceKm} km` : null,
    cardioExtras.calories != null ? `${cardioExtras.calories} kcal` : null,
    cardioExtras.steps != null ? `${cardioExtras.steps} kroków` : null,
  ].filter(Boolean);

  const footerLine =
    workoutsThisWeek != null
      ? workoutFinishFooterLine(workoutsThisWeek)
      : "Po „Gotowe” ciężary trafią do historii i Postępów — Damian widzi je w raporcie.";

  const planLabel = title.trim().toUpperCase() || "TRENING";
  const recordsSectionIndex = 1;
  const bestSetsSectionIndex = weightRecords.length > 0 ? 2 : 1;

  const content = (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[var(--gym-black)] text-white">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="mx-auto w-full max-w-lg px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5">
          <header className="flex items-center gap-3 pt-2">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
              <Trophy
                className="h-5 w-5 text-[var(--gym-gold)]"
                strokeWidth={1.5}
                aria-hidden
              />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]">
                {planLabel}
              </p>
              <h1 className="mt-0.5 font-display text-[1.75rem] font-semibold leading-[1.05] text-white sm:text-[2rem]">
                Trening zrobiony
              </h1>
            </div>
          </header>

          <div className="app-card relative mt-5 overflow-hidden px-4 py-5 sm:px-5">
            <div
              className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(480px_220px_at_50%_0%,rgba(235,196,74,0.12),transparent_60%)]"
              aria-hidden
            />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gym-gold)]">
                Tonaż
              </p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="font-metric text-[2.85rem] leading-none tabular-nums text-white sm:text-[3.15rem]">
                  {tonnage.value}
                </span>
                <span className="pb-1 text-lg font-semibold uppercase tracking-wide text-white/75">
                  {tonnage.unit}
                </span>
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                    Czas
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold tabular-nums text-white">
                    {formatWorkoutDurationPl(elapsedSeconds)}
                  </p>
                </div>
                <div className="border-x border-white/[0.06] px-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                    Serie
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold tabular-nums text-white">
                    {setsDone}
                    {setsTotal > 0 && setsTotal !== setsDone ? (
                      <span className="text-white/35">/{setsTotal}</span>
                    ) : null}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                    Ćwiczenia
                  </p>
                  <p className="mt-1.5 text-[15px] font-semibold tabular-nums text-white">
                    {exerciseCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {weightRecords.length > 0 ? (
            <section className="mt-6 space-y-2.5">
              <SectionLabel
                className="items-center"
                index={recordsSectionIndex}
                title="Nowe rekordy"
                trailing={String(weightRecords.length)}
              />
              <ul className="app-card divide-y divide-white/[0.06]">
                {weightRecords.map((row) => (
                  <FinishListRow
                    key={row.exerciseId}
                    name={row.exerciseName}
                    stat={formatWeightRecordLine(row.previousKg, row.newKg)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {bestSets.length > 0 ? (
            <section className="mt-6 space-y-2.5">
              <SectionLabel
                className="items-center"
                index={bestSetsSectionIndex}
                title="Najlepsze serie"
                trailing={String(bestSets.length)}
              />
              <ul className="app-card divide-y divide-white/[0.06]">
                {bestSets.map((row) => (
                  <FinishListRow
                    key={row.exerciseId}
                    name={row.exerciseName}
                    stat={<BestSetStat row={row} />}
                  />
                ))}
              </ul>
            </section>
          ) : setsDone === 0 ? (
            <p className="mt-6 text-center text-sm text-white/45">
              Brak zaliczonych serii.
            </p>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-[var(--gym-black)]/95 backdrop-blur-md">
        <div className="mx-auto w-full max-w-lg space-y-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <div
            className="flex gap-3 rounded-2xl border border-white/[0.08] bg-[#101010] py-3 pl-3 pr-4"
            role="status"
          >
            <span
              className="w-1 shrink-0 rounded-full bg-emerald-400"
              aria-hidden
            />
            <p className="text-[12px] leading-relaxed text-white/65">{footerLine}</p>
          </div>

          {cardioOpen ? (
            <div className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
              <p className="text-center text-sm text-white/55">
                Minuty cardio po siłowym
              </p>
              <div className="mt-3 flex items-center justify-center gap-4">
                <button
                  type="button"
                  aria-label="Mniej minut"
                  onClick={() => setDraftMinutes((m) => Math.max(1, m - 5))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-lg text-white"
                >
                  −
                </button>
                <p className="min-w-[5rem] text-center font-display text-3xl tabular-nums text-[var(--gym-gold)]">
                  {draftMinutes}
                  <span className="ml-1 text-sm text-white/45">min</span>
                </p>
                <button
                  type="button"
                  aria-label="Więcej minut"
                  onClick={() => setDraftMinutes((m) => Math.min(180, m + 5))}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-lg text-white"
                >
                  +
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Dystans (km)
                  <input
                    value={draftDistance}
                    onChange={(e) => setDraftDistance(e.target.value)}
                    inputMode="decimal"
                    placeholder="opcjonalnie"
                    className="mt-1 h-10 w-full rounded-xl border border-white/12 bg-black/40 px-2 text-sm text-white"
                  />
                </label>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Śr. tętno
                  <input
                    value={draftHr}
                    onChange={(e) => setDraftHr(e.target.value)}
                    inputMode="numeric"
                    placeholder="bpm"
                    className="mt-1 h-10 w-full rounded-xl border border-white/12 bg-black/40 px-2 text-sm text-white"
                  />
                </label>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Kalorie
                  <input
                    value={draftCalories}
                    onChange={(e) => setDraftCalories(e.target.value)}
                    inputMode="numeric"
                    placeholder="kcal"
                    className="mt-1 h-10 w-full rounded-xl border border-white/12 bg-black/40 px-2 text-sm text-white"
                  />
                </label>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Kroki
                  <input
                    value={draftSteps}
                    onChange={(e) => setDraftSteps(e.target.value)}
                    inputMode="numeric"
                    placeholder="opcjonalnie"
                    className="mt-1 h-10 w-full rounded-xl border border-white/12 bg-black/40 px-2 text-sm text-white"
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCardioOpen(false)}
                  className="h-11 flex-1 rounded-xl border border-white/15 text-sm text-white/70"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={saveCardioDraft}
                  className="gym-btn-primary h-11 flex-1 rounded-xl text-sm font-semibold"
                >
                  Zapisz cardio
                </button>
              </div>
            </div>
          ) : cardioMinutes > 0 ? (
            <button
              type="button"
              onClick={() => setCardioOpen(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 text-sm text-[var(--gym-gold)] hover:text-[var(--gym-gold-bright)]"
            >
              <Flame className="h-4 w-4 shrink-0" aria-hidden />
              Cardio: {cardioSummaryBits.join(" · ")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCardioOpen(true)}
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium text-white/70 transition hover:text-white",
              )}
            >
              <Flame className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
              Dodaj cardio po treningu
            </button>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={onDone}
            className="gym-btn-primary inline-flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold disabled:opacity-60"
          >
            {saving ? "Zapisuję…" : "Gotowe"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
