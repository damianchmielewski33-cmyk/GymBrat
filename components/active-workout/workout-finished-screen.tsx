"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import { PrAchievementGraphic } from "@/components/reports/pr-achievement-graphic";
import type { NewMaxHit } from "@/lib/session-new-max";
import type { WorkoutExerciseState } from "@/components/workout/types";
import {
  SessionChromeHeader,
  SessionProgressBar,
} from "@/components/active-workout/session-chrome";
import { bestSetsFromSession } from "@/lib/workout-session-calculations";
import { estimated1RM } from "@/lib/workout-history";
import type { ActiveCardioExtras } from "@/lib/stores/active-workout";
import { cn } from "@/lib/utils";

type WorkoutFinishedScreenProps = {
  title: string;
  elapsedSeconds: number;
  setsDone: number;
  setsTotal: number;
  volumeKg: number;
  exercises: WorkoutExerciseState[];
  cardioMinutes: number;
  cardioExtras: ActiveCardioExtras;
  onCardioMinutesChange: (minutes: number) => void;
  onCardioExtrasChange: (extras: Partial<ActiveCardioExtras>) => void;
  onDone: () => void;
  onReturn: () => void;
  onClose?: () => void;
  saving?: boolean;
  newMaxLabel?: string | null;
  newMaxHit?: NewMaxHit | null;
};

function numOrEmpty(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) && n > 0 ? String(n) : "";
}

function formatElapsed(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function WorkoutFinishedScreen({
  title,
  elapsedSeconds,
  setsDone,
  setsTotal,
  volumeKg,
  exercises,
  cardioMinutes,
  cardioExtras,
  onCardioMinutesChange,
  onCardioExtrasChange,
  onDone,
  onReturn,
  onClose,
  saving,
  newMaxLabel,
  newMaxHit,
}: WorkoutFinishedScreenProps) {
  const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
  const progress = setsTotal > 0 ? Math.min(1, setsDone / setsTotal) : 1;
  const bestSets = useMemo(
    () => bestSetsFromSession(exercises, estimated1RM),
    [exercises],
  );

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

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[var(--gym-black)] text-white">
      <SessionProgressBar progress={progress} className="relative" />
      <SessionChromeHeader
        title={title}
        subtitle={`${formatElapsed(elapsedSeconds)} · ${setsDone}/${setsTotal} serii`}
        onClose={onClose ?? onReturn}
        listDisabled
        className="py-3"
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
        {newMaxHit ? (
          <div className="mt-1 w-full max-w-sm self-center">
            <PrAchievementGraphic
              exerciseName={newMaxHit.exerciseName}
              valueKg={newMaxHit.value}
            />
          </div>
        ) : null}

        <h1 className="mt-4 text-center font-display text-[2rem] font-semibold leading-tight text-white sm:text-[2.15rem]">
          Trening zrobiony
        </h1>
        {newMaxLabel && !newMaxHit ? (
          <p className="mt-3 self-center rounded-full border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/15 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            NOWY MAX · {newMaxLabel}
          </p>
        ) : null}

        <div className="app-card mt-5 grid w-full grid-cols-3 divide-x divide-white/10 py-4">
          <div className="px-2 text-center">
            <p className="app-label text-[var(--gym-gold)]">Czas</p>
            <p className="mt-1 font-display text-2xl tabular-nums text-[var(--gym-gold-bright)]">
              {minutes}
              <span className="text-sm text-white/45"> min</span>
            </p>
          </div>
          <div className="px-2 text-center">
            <p className="app-label text-[var(--gym-gold)]">Serie</p>
            <p className="mt-1 font-display text-2xl tabular-nums text-[var(--gym-gold-bright)]">
              {setsDone}
            </p>
          </div>
          <div className="px-2 text-center">
            <p className="app-label text-[var(--gym-gold)]">Tonaż</p>
            <p className="mt-1 font-display text-2xl tabular-nums text-[var(--gym-gold-bright)]">
              {Math.round(volumeKg)}
              <span className="text-sm text-white/45"> kg</span>
            </p>
          </div>
        </div>

        {bestSets.length > 0 ? (
          <div className="app-card mt-3 w-full overflow-hidden py-1">
            <p className="app-label px-4 pb-1 pt-3 text-[var(--gym-gold)]">
              Najlepsze serie
            </p>
            <ul className="divide-y divide-white/[0.06]">
              {bestSets.map((row) => (
                <li
                  key={row.exerciseId}
                  className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                >
                  <p className="min-w-0 truncate text-[14px] font-medium text-white/90">
                    {row.exerciseName}
                  </p>
                  <p className="shrink-0 text-right text-[13px] tabular-nums text-[var(--gym-gold)]">
                    {row.kind === "bodyweight" ? (
                      <>
                        {row.reps}
                        <span className="text-white/35"> powt.</span>
                      </>
                    ) : (
                      <>
                        {row.weight} × {row.reps}
                        <span className="text-white/35"> · </span>
                        e1RM {row.e1rm}
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : setsDone === 0 ? (
          <p className="mt-3 text-center text-sm text-white/45">
            Brak zaliczonych serii.
          </p>
        ) : null}

        <div className="mt-auto flex w-full flex-col items-center pt-6 pb-[max(1.25rem,calc(env(safe-area-inset-bottom,0px)+0.75rem))]">
          <button
            type="button"
            disabled={saving}
            onClick={onDone}
            className="gym-btn-primary inline-flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold disabled:opacity-60"
          >
            {saving ? "Zapisuję…" : "Gotowe"}
          </button>

          {cardioOpen ? (
            <div className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
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
              className="mt-4 inline-flex min-h-11 items-center gap-2 px-2 text-sm text-[var(--gym-gold)] hover:text-[var(--gym-gold-bright)]"
            >
              <Flame className="h-4 w-4" aria-hidden />
              Cardio: {cardioSummaryBits.join(" · ")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCardioOpen(true)}
              className={cn(
                "mt-4 inline-flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-white/70 transition hover:text-white",
              )}
            >
              <Flame className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
              Dodaj cardio po treningu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
