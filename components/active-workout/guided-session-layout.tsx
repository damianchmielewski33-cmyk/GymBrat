"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Minus,
  Plus,
  Play,
  Video,
  X,
} from "lucide-react";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import {
  formatExerciseTargetLine,
  buildSupersetLabels,
} from "@/lib/start-workout-session";
import {
  formatLastSetLine,
  formatRepRangeLabel,
  resolveRepRange,
} from "@/lib/set-progression-suggestion";
import { buildLiveCoachTipForOpenSet } from "@/lib/live-set-coach";
import { LiveCoachBanner } from "@/components/active-workout/live-coach-banner";
import { requestActiveWorkoutCloudPush } from "@/lib/active-workout-persist";
import { hapticTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { SessionChromeHeader } from "@/components/active-workout/session-chrome";
import { GhostPickerSheet } from "@/components/active-workout/ghost-picker-sheet";
import { GhostRaceHud } from "@/components/active-workout/ghost-race-hud";
import {
  canCompleteWorkoutSet,
  findNextIncompleteExercise,
  isCompletedWorkoutSet,
  isSkippedWorkoutSet,
  resolveAdvanceAfterSet,
} from "@/lib/workout-skipped-sets";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";

const WEIGHT_STEP = 5;
const WEIGHT_FINE = 0.5;

function formatElapsed(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function clampWeight(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(999, Math.round(n * 2) / 2));
}

function clampReps(n: number | null) {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

function parseWeightInput(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return clampWeight(n);
}

function parseRepsInput(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return clampReps(n);
}

function daysAgoLabel(days: number | null | undefined): string | null {
  if (days == null || !Number.isFinite(days) || days < 0) return null;
  if (days === 0) return "dziś";
  if (days === 1) return "wczoraj";
  if (days < 7) return `${Math.round(days)} dni temu`;
  return null;
}

function exerciseTargetBadges(exercise: WorkoutExerciseState): string[] {
  const badges: string[] = [];
  const sets = exercise.targetSets ?? exercise.sets.length;
  const setsLabel = `${sets} ${plSeries(sets)}`;
  const repRange = resolveRepRange(exercise.targetReps);
  if (repRange) {
    badges.push(`${setsLabel} × ${formatRepRangeLabel(repRange)}`);
  } else if (exercise.targetReps != null && exercise.targetReps > 0) {
    badges.push(`${setsLabel} × ${exercise.targetReps}`);
  } else {
    badges.push(setsLabel);
  }
  if (exercise.targetRir != null) badges.push(`RIR ${exercise.targetRir}`);
  if (exercise.tempo?.trim()) badges.push(`tempo ${exercise.tempo.trim()}`);
  return badges;
}

/** Kroki zmiany ciężaru przyciskami +/− (plakietka „krok” przełącza po kolei). */
const WEIGHT_STEPS = [WEIGHT_FINE, 2.5, WEIGHT_STEP] as const;

function formatStep(step: number): string {
  return String(step).replace(".", ",");
}

function plSeries(n: number): string {
  if (n === 1) return "seria";
  if (n >= 2 && n <= 4) return "serie";
  return "serii";
}

/** Stałe, niskie wymiary: +/− 52 px, liczby 50 px, wszystkie pola dotyku ≥ 44 px. */
const stepperBtnClass =
  "inline-flex h-[52px] w-[72px] shrink-0 items-center justify-center rounded-[16px] border border-white/12 bg-[#0A0A0A] text-white transition active:scale-[0.96] hover:border-[#D6B36A]/35 hover:bg-white/[0.07]";

const metricInputBaseClass =
  "h-[56px] min-w-0 bg-transparent px-0 text-left font-metric text-[50px] leading-none tabular-nums tracking-tight outline-none";

const weightInputClass =
  `${metricInputBaseClass} text-[#D6B36A] placeholder:text-[#D6B36A]/35`;

const repsInputClass =
  `${metricInputBaseClass} text-white placeholder:text-white/30`;

/** Karty Ciężar i Powtórzenia: jedna pod drugą, liczba po lewej, +/− po prawej. */
const metricCardClass =
  "overflow-hidden rounded-[18px] border border-white/[0.08] border-t-[#D6B36A]/20 bg-[#121212] px-4 py-3 shadow-[0_0_28px_rgba(214,179,106,0.06),inset_0_1px_0_rgba(255,255,255,0.04)]";

const actionBtnClass =
  "inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-2xl border border-white/10 bg-[#121212] px-2 text-[13px] font-semibold transition hover:border-[#D6B36A]/30";

/** Segmenty = serie całej sesji; złote = zaliczone. */
function SegmentedSessionProgress({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const n = Math.max(1, total);
  return (
    <div
      className="flex h-1.5 gap-[3px]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
    >
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-full min-w-0 flex-1 rounded-full transition-colors duration-300",
            i < done
              ? "bg-gradient-to-r from-[#D6B36A] to-[#F0D58A] shadow-[0_0_8px_rgba(214,179,106,0.4)]"
              : "bg-white/[0.1]",
          )}
        />
      ))}
    </div>
  );
}

type GuidedSessionLayoutProps = {
  title: string;
  elapsedSeconds: number;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  listOpen?: boolean;
  onListOpenChange?: (open: boolean) => void;
  onSelectExercise: (id: string) => void;
  onPatchSet: (exerciseId: string, setIndex: number, patch: Partial<WorkoutSetState>) => void;
  onAddSet?: (exerciseId: string) => number | null | void;
  onRemoveLastSet?: (exerciseId: string) => number | null | void;
  onExerciseNoteChange?: (exerciseId: string, note: string) => void;
  onCancelSession?: () => void;
  /** Zakończ bez zapisu (jawny przycisk). */
  onDiscardSession?: () => void;
  onFinishSession?: () => void;
  finishPending?: boolean;
  onDeferExercise?: () => void;
  /** Skok do konkretnej serii (np. „Wróć do pominiętej”) — nonce wymusza ponowne ustawienie. */
  focusSetRequest?: {
    exerciseId: string;
    setIndex: number;
    nonce: number;
  } | null;
  onFocusSetHandled?: () => void;
};

export function GuidedSessionLayout({
  title,
  elapsedSeconds,
  exercises,
  selectedExerciseId,
  listOpen: listOpenControlled,
  onListOpenChange,
  onSelectExercise,
  onPatchSet,
  onAddSet,
  onRemoveLastSet,
  onExerciseNoteChange,
  onCancelSession,
  onFinishSession,
  finishPending,
  onDeferExercise,
  focusSetRequest,
  onFocusSetHandled,
}: GuidedSessionLayoutProps) {
  const workoutPlanId = useActiveWorkoutStore((s) => s.workoutPlanId);
  const [listOpenLocal, setListOpenLocal] = useState(false);
  const listOpen = listOpenControlled ?? listOpenLocal;
  function setListOpen(open: boolean) {
    onListOpenChange?.(open);
    if (listOpenControlled === undefined) setListOpenLocal(open);
  }
  const [noteOpen, setNoteOpen] = useState(false);
  const [weightStepIdx, setWeightStepIdx] = useState(0);
  const weightStep = WEIGHT_STEPS[weightStepIdx] ?? WEIGHT_FINE;
  /** Ręczny wybór serii (null = pierwsza niedokończona). */
  const [manualSetIndex, setManualSetIndex] = useState<number | null>(null);
  const [weightText, setWeightText] = useState("");
  const [repsText, setRepsText] = useState("");
  /** Po zmianie ćwiczenia ustaw tę serię zamiast auto (np. Wstecz → ostatnia seria). */
  const pendingSetIndexRef = useRef<number | null>(null);
  const weightTextRef = useRef(weightText);
  const repsTextRef = useRef(repsText);
  weightTextRef.current = weightText;
  repsTextRef.current = repsText;

  const selectedIndex = Math.max(
    0,
    exercises.findIndex((e) => e.id === selectedExerciseId),
  );
  const exercise = exercises[selectedIndex] ?? exercises[0] ?? null;

  const autoSetIndex = useMemo(() => {
    if (!exercise) return 0;
    const firstOpen = exercise.sets.findIndex((s) => !s.done);
    return firstOpen >= 0 ? firstOpen : Math.max(0, exercise.sets.length - 1);
  }, [exercise]);

  const activeSetIndex =
    manualSetIndex != null &&
    exercise &&
    manualSetIndex >= 0 &&
    manualSetIndex < exercise.sets.length
      ? manualSetIndex
      : autoSetIndex;

  const set = exercise?.sets[activeSetIndex] ?? null;
  const canZaliczyc =
    set != null &&
    canCompleteWorkoutSet(
      parseWeightInput(weightText) ?? clampWeight(set.weight),
      (() => {
        const fromInput = parseRepsInput(repsText);
        const r = clampReps(fromInput ?? set.reps ?? exercise?.targetReps ?? 0);
        return r > 0 ? r : null;
      })(),
    );
  const exerciseRef = useRef(exercise);
  const activeSetIndexRef = useRef(activeSetIndex);
  const setRef = useRef(set);
  exerciseRef.current = exercise;
  activeSetIndexRef.current = activeSetIndex;
  setRef.current = set;

  useEffect(() => {
    if (pendingSetIndexRef.current != null) {
      setManualSetIndex(pendingSetIndexRef.current);
      pendingSetIndexRef.current = null;
      return;
    }
    setManualSetIndex(null);
  }, [exercise?.id]);

  useEffect(() => {
    if (!focusSetRequest || !exercise) return;
    if (focusSetRequest.exerciseId !== exercise.id) return;
    const idx = Math.max(
      0,
      Math.min(exercise.sets.length - 1, focusSetRequest.setIndex),
    );
    setManualSetIndex(idx);
    onFocusSetHandled?.();
  }, [
    focusSetRequest?.nonce,
    focusSetRequest?.exerciseId,
    focusSetRequest?.setIndex,
    exercise?.id,
    exercise?.sets.length,
    onFocusSetHandled,
  ]);

  useEffect(() => {
    if (!set) return;
    setWeightText(set.weight > 0 ? String(set.weight) : "");
    const r = set.reps != null ? set.reps : (exercise?.targetReps ?? null);
    setRepsText(r != null && r > 0 ? String(r) : "");
  }, [exercise?.id, activeSetIndex, set?.weight, set?.reps, exercise?.targetReps]);

  const totals = useMemo(() => {
    let done = 0;
    let total = 0;
    let exercisesDone = 0;
    for (const ex of exercises) {
      let exDone = true;
      for (const s of ex.sets) {
        total += 1;
        if (s.done) done += 1;
        else exDone = false;
      }
      if (ex.sets.length > 0 && exDone) exercisesDone += 1;
    }
    return { done, total, exercisesDone, exercisesTotal: exercises.length };
  }, [exercises]);

  const supersetLabels = useMemo(
    () => buildSupersetLabels(exercises),
    [exercises],
  );
  const suggestedWeight =
    exercise?.suggestedWeights?.[activeSetIndex] != null &&
    (exercise.suggestedWeights[activeSetIndex] ?? 0) > 0
      ? exercise.suggestedWeights[activeSetIndex]!
      : null;

  const lastSessionSet =
    exercise?.lastSessionSets?.[activeSetIndex] ?? null;
  const lastSetLine = lastSessionSet
    ? formatLastSetLine(lastSessionSet)
    : null;
  const lastWhen = daysAgoLabel(exercise?.coachContext?.daysSinceLastSession);
  const liveTip = useMemo(
    () =>
      exercise
        ? buildLiveCoachTipForOpenSet(exercise, activeSetIndex)
        : null,
    [exercise, activeSetIndex, exercise?.sets, exercise?.lastSessionSets],
  );
  const targetBadges = useMemo(
    () => (exercise ? exerciseTargetBadges(exercise) : []),
    [exercise],
  );

  /** Zapisuje bieżące pola do store bez zmiany statusu zaliczenia. */
  function flushDraft(opts?: { keepDone?: boolean; pushImmediate?: boolean }) {
    const ex = exerciseRef.current;
    const idx = activeSetIndexRef.current;
    const current = setRef.current;
    if (!ex || !current) return;

    const weightParsed = parseWeightInput(weightTextRef.current);
    const repsParsed = parseRepsInput(repsTextRef.current);
    const weight =
      weightParsed != null
        ? weightParsed
        : weightTextRef.current.trim() === ""
          ? 0
          : clampWeight(current.weight);
    const reps =
      repsParsed != null
        ? repsParsed > 0
          ? repsParsed
          : null
        : repsTextRef.current.trim() === ""
          ? null
          : current.reps;

    const keepDone = opts?.keepDone ?? current.done;
    onPatchSet(ex.id, idx, {
      weight,
      reps,
      done: keepDone,
      skipped: keepDone ? current.skipped : false,
    });
    requestActiveWorkoutCloudPush(opts?.pushImmediate === true);
  }

  function selectSetIndex(nextIndex: number) {
    if (!exercise) return;
    if (nextIndex === activeSetIndex) return;
    flushDraft();
    setManualSetIndex(nextIndex);
  }

  function goPrev() {
    if (!exercise) return;
    hapticTap();
    flushDraft();
    if (activeSetIndex > 0) {
      setManualSetIndex(activeSetIndex - 1);
      return;
    }
    if (selectedIndex > 0) {
      const prev = exercises[selectedIndex - 1]!;
      pendingSetIndexRef.current = Math.max(0, prev.sets.length - 1);
      onSelectExercise(prev.id);
    }
  }

  function skipSet() {
    if (!exercise || !set) return;
    hapticTap();
    const weight = parseWeightInput(weightText) ?? clampWeight(set.weight);
    const repsParsed = parseRepsInput(repsText);
    const exerciseId = exercise.id;
    const setIndex = activeSetIndex;
    onPatchSet(exerciseId, setIndex, {
      done: true,
      skipped: true,
      reps: repsParsed != null && repsParsed > 0 ? repsParsed : set.reps,
      weight,
      rir: set.rir ?? null,
    });
    requestActiveWorkoutCloudPush(true);
    advanceAfterComplete(exerciseId, setIndex);
  }

  function advanceAfterComplete(exerciseId: string, setIndex: number) {
    // Po patchu bierz świeży stan ze store — props `exercises` jest jeszcze stary.
    const exercisesNow = useActiveWorkoutStore.getState().exercises;
    const target = resolveAdvanceAfterSet(exercisesNow, exerciseId, setIndex);
    if (!target) {
      setManualSetIndex(null);
      return;
    }
    if (target.exerciseId === exerciseId) {
      setManualSetIndex(target.setIndex);
      return;
    }
    pendingSetIndexRef.current = target.setIndex;
    setManualSetIndex(null);
    onSelectExercise(target.exerciseId);
  }

  function completeSet() {
    if (!exercise || !set) return;
    const fromInput = parseRepsInput(repsText);
    const reps = clampReps(fromInput ?? set.reps ?? exercise.targetReps ?? 0);
    const weight = parseWeightInput(weightText) ?? clampWeight(set.weight);
    if (!canCompleteWorkoutSet(weight, reps > 0 ? reps : null)) {
      // Bez ciężaru (> 0) lub powtórzeń nie zaliczamy — użyj „Pomiń serię”.
      return;
    }
    hapticTap();
    onPatchSet(exercise.id, activeSetIndex, {
      done: true,
      skipped: false,
      reps,
      weight,
      rir: set.rir ?? null,
    });
    requestActiveWorkoutCloudPush(true);
    advanceAfterComplete(exercise.id, activeSetIndex);
  }

  function patchWeight(next: number) {
    if (!exercise || !set) return;
    setWeightText(next > 0 ? String(next) : "");
    onPatchSet(exercise.id, activeSetIndex, {
      weight: next,
      done: set.done,
      skipped: set.done ? set.skipped : false,
    });
    requestActiveWorkoutCloudPush(false);
  }

  function patchReps(next: number | null) {
    if (!exercise || !set) return;
    setRepsText(next != null && next > 0 ? String(next) : "");
    onPatchSet(exercise.id, activeSetIndex, {
      reps: next != null && next > 0 ? next : null,
      done: set.done,
      skipped: set.done ? set.skipped : false,
    });
    requestActiveWorkoutCloudPush(false);
  }

  if (!exercise || !set) {
    return (
      <div className="px-4 py-16 text-center text-sm text-white/50">
        Brak ćwiczeń w sesji.
      </div>
    );
  }

  const rirValue = set.rir ?? exercise.targetRir ?? 1;
  const techniqueUrl = exercise.techniqueYoutubeUrl?.trim() || null;
  const repRangeForHint = resolveRepRange(exercise.targetReps);
  const repTargetHint = repRangeForHint
    ? `cel ${formatRepRangeLabel(repRangeForHint)}`
    : exercise.targetReps != null && exercise.targetReps > 0
      ? `cel ${exercise.targetReps}`
      : null;

  function applyLiveTip(apply: { weightKg: number; reps: number }) {
    if (!exercise || !set) return;
    patchWeight(clampWeight(apply.weightKg));
    patchReps(clampReps(apply.reps));
  }

  /** „Powtórz bazę”: ciężar i powtórzenia tej samej serii z poprzedniego treningu. */
  function repeatBase() {
    if (!exercise || !set || !lastSessionSet) return;
    const w = clampWeight(Number(lastSessionSet.weight) || 0);
    const r =
      lastSessionSet.reps != null && lastSessionSet.reps > 0
        ? clampReps(lastSessionSet.reps)
        : null;
    hapticTap();
    setWeightText(w > 0 ? String(w) : "");
    setRepsText(r != null && r > 0 ? String(r) : "");
    onPatchSet(exercise.id, activeSetIndex, {
      weight: w,
      reps: r ?? set.reps,
      done: set.done,
      skipped: set.done ? set.skipped : false,
    });
    requestActiveWorkoutCloudPush(false);
  }

  const repsNow = parseRepsInput(repsText) ?? set.reps ?? null;
  const repsInTarget =
    repRangeForHint != null &&
    repsNow != null &&
    repsNow >= repRangeForHint.min &&
    repsNow <= repRangeForHint.max;

  const setCompleted = set.done && !isSkippedWorkoutSet(set);
  const primaryLabel = setCompleted
    ? `Popraw serię ${activeSetIndex + 1}`
    : canZaliczyc
      ? `Zapisz serię ${activeSetIndex + 1}`
      : "Pomiń serię";

  return (
    <div className="relative mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden bg-black text-white">
      <div className="shrink-0 border-b border-white/[0.06] bg-black">
        <SessionChromeHeader
          title={title}
          subtitle={
            <span className="font-metric text-[20px] leading-none tabular-nums tracking-wide text-[#D6B36A]">
              {formatElapsed(elapsedSeconds)}
            </span>
          }
          onClose={onCancelSession}
          onOpenList={() => {
            flushDraft();
            setListOpen(true);
          }}
          className="px-3 pb-1"
        />
        <div className="px-4 pb-2.5">
          <SegmentedSessionProgress done={totals.done} total={totals.total} />
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <GhostPickerSheet planId={workoutPlanId} />
            <p className="shrink-0 text-[12px] tabular-nums text-white/55">
              {totals.done}/{totals.total} serii · {totals.exercisesDone}/
              {totals.exercisesTotal} ćw.
            </p>
          </div>
          <GhostRaceHud />
        </div>
      </div>

      {/*
        Środek: bloki rozkładają się równomiernie na dostępnej wysokości (justify-between),
        więc na wyższych ekranach nie ma pustej dziury. Na bardzo niskim ekranie treść
        można jeszcze lekko przewinąć gestem — pasek przewijania jest ukryty.
      */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-2 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-h-full flex-1 flex-col justify-between gap-2.5">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Ćwiczenie {selectedIndex + 1} z {exercises.length}
                  {supersetLabels[exercise.id] ? (
                    <>
                      <span className="text-white/25"> · </span>
                      <span className="text-[#D6B36A]">
                        {supersetLabels[exercise.id]}
                      </span>
                    </>
                  ) : null}
                </p>
                <h2 className="mt-1 line-clamp-2 text-[24px] font-semibold leading-[1.1] tracking-tight text-white">
                  {exercise.name}
                </h2>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {techniqueUrl ? (
                  <a
                    href={techniqueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] text-[#D6B36A]"
                    aria-label="Technika"
                  >
                    <Play className="h-4 w-4" />
                  </a>
                ) : null}
                <Link
                  href="/technique"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] text-[#D6B36A]"
                  aria-label="Nagraj technikę"
                >
                  <Video className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {targetBadges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex h-8 items-center rounded-full border border-white/12 bg-[#121212] px-3 text-[13px] font-semibold tabular-nums text-white"
                  >
                    {badge}
                  </span>
                ))}
              </div>

              {/* Numerowane serie: kółko 34 px w polu dotyku 44 px. */}
              <div
                className="flex shrink-0 items-center"
                role="tablist"
                aria-label="Serie ćwiczenia"
              >
                {exercise.sets.map((s, i) => {
                  const completed = isCompletedWorkoutSet(s);
                  const skipped = isSkippedWorkoutSet(s);
                  const active = i === activeSetIndex;
                  return (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-label={`Seria ${i + 1}${
                        completed
                          ? ", zaliczona"
                          : skipped
                            ? ", pominięta"
                            : active
                              ? ", aktualna"
                              : ""
                      }`}
                      aria-selected={active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSetIndex(i)}
                      className="inline-flex h-11 w-10 items-center justify-center"
                    >
                      <span
                        className={cn(
                          "inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border text-[14px] font-bold tabular-nums transition",
                          completed
                            ? "border-[#76D686]/55 bg-[#76D686]/15 text-[#76D686]"
                            : skipped
                              ? "border-orange-400/55 bg-orange-400/10 text-orange-300"
                              : active
                                ? "border-[#D6B36A]/60 bg-[#D6B36A]/20 text-[#F0D58A]"
                                : "border-white/12 bg-[#121212] text-white/70",
                          active && "ring-2 ring-[#D6B36A]/50",
                        )}
                      >
                        {i + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <LiveCoachBanner
              tip={liveTip}
              onApply={applyLiveTip}
              className="mt-2 rounded-[16px] py-2"
              compact
            />
          </div>

          {lastSetLine || suggestedWeight != null ? (
            <div className="rounded-[18px] border border-white/[0.08] bg-[#121212] px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12px] text-white/50">
                  Ostatnio{lastWhen ? ` · ${lastWhen}` : ""}
                </p>
                <p className="text-[16px] font-semibold tabular-nums text-white">
                  {lastSetLine ? lastSetLine.replace(/^Ostatnio\s+/, "") : "—"}
                </p>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!lastSessionSet || !lastSetLine}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={repeatBase}
                  className="h-11 rounded-full border border-[#D6B36A]/35 bg-[#D6B36A]/10 px-3 text-[14px] font-semibold text-[#E8C97A] transition hover:bg-[#D6B36A]/15 disabled:opacity-40"
                >
                  Powtórz bazę
                </button>
                <button
                  type="button"
                  disabled={suggestedWeight == null}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (suggestedWeight == null) return;
                    hapticTap();
                    patchWeight(clampWeight(suggestedWeight));
                  }}
                  className="h-11 rounded-full border border-white/15 bg-transparent px-3 text-[14px] font-semibold text-white transition hover:bg-white/[0.05] disabled:opacity-40"
                >
                  {suggestedWeight != null
                    ? `Sugestia: ${String(suggestedWeight).replace(".", ",")} kg`
                    : "Brak sugestii"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2.5">
            <div className={metricCardClass}>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="set-weight"
                  className="text-[13px] font-semibold text-white/70"
                >
                  Ciężar
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setWeightStepIdx((i) => (i + 1) % WEIGHT_STEPS.length)
                  }
                  aria-label={`Krok zmiany ciężaru ${formatStep(weightStep)} kg — dotknij, aby zmienić`}
                  className="-my-2 inline-flex h-11 items-center px-0.5"
                >
                  <span className="inline-flex h-7 items-center rounded-full border border-[#D6B36A]/30 bg-[#D6B36A]/10 px-2.5 text-[12px] font-semibold text-[#E8C97A]">
                    krok {formatStep(weightStep)}
                  </span>
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-end gap-1.5">
                  <input
                    id="set-weight"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min={0}
                    max={999}
                    value={weightText}
                    placeholder={
                      suggestedWeight != null ? String(suggestedWeight) : "0"
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      setWeightText(raw);
                      const parsed = parseWeightInput(raw);
                      if (parsed != null) {
                        onPatchSet(exercise.id, activeSetIndex, {
                          weight: parsed,
                          done: set.done,
                          skipped: set.done ? set.skipped : false,
                        });
                        requestActiveWorkoutCloudPush(false);
                      } else if (raw.trim() === "") {
                        onPatchSet(exercise.id, activeSetIndex, {
                          weight: 0,
                          done: set.done,
                          skipped: set.done ? set.skipped : false,
                        });
                        requestActiveWorkoutCloudPush(false);
                      }
                    }}
                    onBlur={() => {
                      flushDraft();
                      const parsed = parseWeightInput(weightTextRef.current);
                      setWeightText(
                        parsed != null && parsed > 0 ? String(parsed) : "",
                      );
                    }}
                    className={cn(weightInputClass, "min-w-0 flex-1")}
                  />
                  <span className="mb-2.5 shrink-0 text-[14px] font-semibold lowercase tracking-wide text-[#D6B36A]/80">
                    kg
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    aria-label="Zmniejsz ciężar"
                    onClick={() => {
                      patchWeight(
                        clampWeight(
                          (parseWeightInput(weightText) ?? set.weight) -
                            weightStep,
                        ),
                      );
                    }}
                    className={stepperBtnClass}
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Zwiększ ciężar"
                    onClick={() => {
                      patchWeight(
                        clampWeight(
                          (parseWeightInput(weightText) ?? set.weight) +
                            weightStep,
                        ),
                      );
                    }}
                    className={stepperBtnClass}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className={metricCardClass}>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="set-reps"
                  className="text-[13px] font-semibold text-white/70"
                >
                  Powtórzenia
                </label>
                {repTargetHint ? (
                  <span
                    className={cn(
                      "text-[12px] font-semibold tabular-nums",
                      repsInTarget ? "text-[#E8C97A]" : "text-white/40",
                    )}
                  >
                    {repsInTarget && repRangeForHint
                      ? `✓ w celu ${formatRepRangeLabel(repRangeForHint)}`
                      : repTargetHint}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <input
                  id="set-reps"
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={0}
                  max={99}
                  value={repsText}
                  placeholder="0"
                  onChange={(e) => {
                    const raw = e.target.value;
                    setRepsText(raw);
                    const parsed = parseRepsInput(raw);
                    if (parsed != null) {
                      onPatchSet(exercise.id, activeSetIndex, {
                        reps: parsed > 0 ? parsed : null,
                        done: set.done,
                        skipped: set.done ? set.skipped : false,
                      });
                      requestActiveWorkoutCloudPush(false);
                    } else if (raw.trim() === "") {
                      onPatchSet(exercise.id, activeSetIndex, {
                        reps: null,
                        done: set.done,
                        skipped: set.done ? set.skipped : false,
                      });
                      requestActiveWorkoutCloudPush(false);
                    }
                  }}
                  onBlur={() => {
                    flushDraft();
                    const parsed = parseRepsInput(repsTextRef.current);
                    setRepsText(
                      parsed != null && parsed > 0 ? String(parsed) : "",
                    );
                  }}
                  className={cn(repsInputClass, "min-w-0 flex-1")}
                />
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    aria-label="Mniej powtórzeń"
                    onClick={() => {
                      const cur =
                        parseRepsInput(repsText) ??
                        clampReps(set.reps ?? exercise.targetReps ?? 0);
                      const next = Math.max(0, cur - 1);
                      patchReps(next > 0 ? next : null);
                    }}
                    className={stepperBtnClass}
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Więcej powtórzeń"
                    onClick={() => {
                      const cur =
                        parseRepsInput(repsText) ??
                        clampReps(set.reps ?? exercise.targetReps ?? 0);
                      patchReps(Math.min(99, cur + 1));
                    }}
                    className={stepperBtnClass}
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-white/75">
                RIR · powtórzenia w zapasie
              </p>
              {exercise.targetRir != null ? (
                <p className="text-[12px] font-medium tabular-nums text-white/45">
                  cel: {exercise.targetRir}
                </p>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((v) => {
                const active = rirValue === v || (v === 3 && rirValue >= 3);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() =>
                      onPatchSet(exercise.id, activeSetIndex, {
                        rir: v,
                        done: set.done,
                        skipped: set.done ? set.skipped : false,
                      })
                    }
                    className={cn(
                      "h-12 rounded-[14px] text-[16px] font-bold tabular-nums transition active:scale-[0.97]",
                      active
                        ? "border border-[#F0D58A]/70 bg-gradient-to-b from-[#F0D58A] via-[#D6B36A] to-[#A8893F] text-black shadow-[0_0_24px_rgba(214,179,106,0.45)]"
                        : "border border-white/12 bg-[#0A0A0A] text-white/75 hover:border-[#D6B36A]/40",
                    )}
                  >
                    {v === 3 ? "3+" : v}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex gap-2">
              {onAddSet ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    flushDraft();
                    const stayAt = activeSetIndex;
                    onAddSet(exercise.id);
                    setManualSetIndex(stayAt);
                  }}
                  className={cn(actionBtnClass, "border-[#D6B36A]/30 text-[#E8C97A]")}
                >
                  + Seria
                </button>
              ) : null}
              {onRemoveLastSet && exercise.sets.length > 1 ? (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    flushDraft();
                    const nextIndex = onRemoveLastSet(exercise.id);
                    setManualSetIndex(
                      typeof nextIndex === "number" ? nextIndex : null,
                    );
                  }}
                  className={cn(actionBtnClass, "text-white")}
                >
                  Usuń
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setNoteOpen((v) => !v)}
                aria-expanded={noteOpen}
                className={cn(actionBtnClass, "text-white")}
              >
                Notatka
              </button>
              <button
                type="button"
                onClick={() => {
                  const subject = encodeURIComponent(
                    `Zgłoszenie ćwiczenia: ${exercise.name}`,
                  );
                  const body = encodeURIComponent(
                    `Ćwiczenie: ${exercise.name}\nPlan: ${title}\n\nOpis problemu:\n`,
                  );
                  window.location.href = `mailto:support@gymbrat.app?subject=${subject}&body=${body}`;
                }}
                className={cn(actionBtnClass, "text-white/45")}
              >
                Zgłoś
              </button>
            </div>

            {noteOpen ? (
              <Textarea
                value={exercise.note ?? ""}
                onChange={(e) =>
                  onExerciseNoteChange?.(exercise.id, e.target.value)
                }
                placeholder="Notatka do ćwiczenia…"
                className="mt-2 min-h-[56px] rounded-xl border-white/12 bg-[#0A0A0A] text-sm text-white"
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-black px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5">
        <button
          type="button"
          // Blur inputu przed clickiem potrafił ustawić done:false zaraz po zaliczeniu
          // i psuć kolejne starty przerwy — blokujemy blur przed obsługą kliknięcia.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (set.done && !isSkippedWorkoutSet(set)) {
              completeSet();
              return;
            }
            if (canZaliczyc) {
              completeSet();
              return;
            }
            skipSet();
          }}
          className={cn(
            "inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[17px] font-bold",
            setCompleted
              ? "border border-[#76D686]/55 bg-[#76D686] text-[#0A1A0E] shadow-[0_0_30px_rgba(118,214,134,0.38)]"
              : "gym-btn-primary shadow-[0_0_30px_rgba(214,179,106,0.38)]",
          )}
        >
          {setCompleted || canZaliczyc ? (
            <>
              <Check className="h-5 w-5" />
              {primaryLabel}
            </>
          ) : (
            <>
              <X className="h-5 w-5" />
              {primaryLabel}
            </>
          )}
        </button>

        <div className="mt-1 grid grid-cols-4 gap-0.5 text-center text-[13px] font-semibold text-white/80">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={goPrev}
            className="min-h-11 rounded-lg px-0.5 transition hover:bg-white/[0.04] hover:text-white"
          >
            Wstecz
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={skipSet}
            disabled={!canZaliczyc && !(set.done && !isSkippedWorkoutSet(set))}
            className="min-h-11 rounded-lg px-0.5 transition hover:bg-white/[0.04] hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            Pomiń serię
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              hapticTap();
              flushDraft();
              onDeferExercise?.();
              const next = findNextIncompleteExercise(exercises, exercise.id);
              if (next) onSelectExercise(next.id);
            }}
            className="min-h-11 rounded-lg px-0.5 transition hover:bg-white/[0.04] hover:text-white"
          >
            Później
          </button>
          <button
            type="button"
            disabled={finishPending}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              hapticTap();
              flushDraft();
              onFinishSession?.();
            }}
            className="min-h-11 rounded-lg px-0.5 font-bold text-[#D6B36A] transition hover:bg-[#D6B36A]/10 hover:text-[#F0D58A] disabled:opacity-50"
          >
            {finishPending ? "…" : "Zakończ"}
          </button>
        </div>
      </div>

      {listOpen ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black">
          <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.5rem))]">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D6B36A]">
                Lista ćwiczeń
              </p>
              <h3 className="mt-1 text-3xl font-semibold text-white">{title}</h3>
            </div>
            <button
              type="button"
              onClick={() => setListOpen(false)}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/12"
              aria-label="Zamknij"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="mx-3 mb-4 min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0A0A0A] shadow-[0_0_28px_rgba(214,179,106,0.06)]">
            <ul className="h-full overflow-y-auto px-2 py-2">
              {exercises.map((ex, i) => {
                const doneAll = ex.sets.every((s) => isCompletedWorkoutSet(s));
                const active = ex.id === exercise.id;
                const nameClass = doneAll
                  ? "text-emerald-400"
                  : active
                    ? "text-[#D6B36A]"
                    : "text-white";
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        flushDraft();
                        onSelectExercise(ex.id);
                        setListOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-4 text-left hover:bg-white/[0.03]"
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block text-[16px] font-semibold",
                            nameClass,
                          )}
                        >
                          {i + 1}. {ex.name}
                        </span>
                        <span className="mt-1 block text-[13px] text-white/45">
                          {formatExerciseTargetLine(ex)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {ex.sets.map((s, si) => (
                          <span
                            key={si}
                            className={cn(
                              "h-2 w-2 rounded-full",
                              isCompletedWorkoutSet(s)
                                ? "bg-emerald-400"
                                : isSkippedWorkoutSet(s)
                                  ? "bg-orange-400"
                                  : active
                                    ? "bg-white/25"
                                    : "bg-white/20",
                            )}
                          />
                        ))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
