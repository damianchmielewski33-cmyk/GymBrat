"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Flag,
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
import {
  SessionChromeHeader,
  SessionProgressBar,
} from "@/components/active-workout/session-chrome";
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
  const repRange = resolveRepRange(exercise.targetReps);
  if (repRange) {
    badges.push(`${sets}s ${formatRepRangeLabel(repRange)}`);
  } else if (exercise.targetReps != null && exercise.targetReps > 0) {
    badges.push(`${sets}s ${exercise.targetReps}`);
  } else {
    badges.push(`${sets}s`);
  }
  if (exercise.targetRir != null) badges.push(`RIR ${exercise.targetRir}`);
  if (exercise.tempo?.trim()) badges.push(`tempo ${exercise.tempo.trim()}`);
  return badges;
}

/** Steppery / metryki skalują się z wysokością viewport (RWD bez scrolla). */
const stepperBtnClass =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/12 bg-[#121212] text-white transition active:scale-[0.96] hover:border-[#D6B36A]/35 hover:bg-white/[0.07] min-[700px]:h-12 min-[700px]:w-12 min-[700px]:rounded-[16px] sm:h-14 sm:w-14";

const fineBtnClass =
  "inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-xl border border-white/10 bg-[#121212] text-[11px] font-semibold tabular-nums text-white/70 transition active:scale-[0.98] hover:border-[#D6B36A]/30 hover:text-white min-[700px]:h-10 min-[700px]:text-[12px]";

const metricInputBaseClass =
  "h-12 min-w-0 w-full bg-transparent px-0.5 text-center font-metric text-[clamp(1.85rem,6.5dvh,3rem)] leading-none tabular-nums tracking-tight outline-none min-[700px]:h-14 sm:h-16";

const weightInputClass =
  `${metricInputBaseClass} text-[#D6B36A] placeholder:text-[#D6B36A]/35`;

const repsInputClass =
  `${metricInputBaseClass} text-white placeholder:text-white/30`;

const premiumCardClass =
  "flex min-h-0 flex-1 flex-col justify-center rounded-[18px] border border-white/[0.08] border-t-[#D6B36A]/20 bg-[#121212] px-3 py-3.5 shadow-[0_0_28px_rgba(214,179,106,0.06),inset_0_1px_0_rgba(255,255,255,0.04)] min-[700px]:rounded-[20px] min-[700px]:px-3.5 min-[700px]:py-4 sm:rounded-[24px] sm:px-4 sm:py-5";

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
  onDiscardSession,
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
  const progress = totals.total > 0 ? Math.min(1, totals.done / totals.total) : 0;
  const techniqueUrl = exercise.techniqueYoutubeUrl?.trim() || null;

  function applyLiveTip(apply: { weightKg: number; reps: number }) {
    if (!exercise || !set) return;
    patchWeight(clampWeight(apply.weightKg));
    patchReps(clampReps(apply.reps));
  }

  const setCompleted = set.done && !isSkippedWorkoutSet(set);
  const primaryLabel = setCompleted
    ? "Popraw serię"
    : canZaliczyc
      ? "Zalicz serię"
      : "Pomiń serię";

  return (
    <div className="relative mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden bg-black text-white">
      <div className="shrink-0 border-b border-white/[0.06] bg-black">
        <SessionChromeHeader
          title={title}
          subtitle={
            <div className="flex flex-col items-center gap-0.5">
              <span className="font-metric text-[16px] tabular-nums tracking-wide text-[#D6B36A] sm:text-[18px]">
                {formatElapsed(elapsedSeconds)}
              </span>
              <span className="text-[10px] text-white/45 sm:text-[11px]">
                {totals.done}/{totals.total} serii · {totals.exercisesDone}/
                {totals.exercisesTotal} ćw.
              </span>
            </div>
          }
          onClose={onCancelSession}
          onOpenList={() => {
            flushDraft();
            setListOpen(true);
          }}
          className="px-2 pb-0.5"
        />
        <div className="space-y-2 px-5 pb-2">
          <SessionProgressBar progress={progress} />
          <GhostPickerSheet planId={workoutPlanId} />
          <GhostRaceHud />
        </div>
      </div>

      {/* Środkowa treść: karty Ciężar/Powtórzenia rosną i wypełniają wolne miejsce; scroll tylko awaryjnie. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3.5 pb-2 pt-2.5 sm:px-4 sm:pt-3">
        <div className="flex min-h-full flex-1 flex-col">
          <div className="shrink-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                  Ćw. {selectedIndex + 1}/{exercises.length}
                  {supersetLabels[exercise.id] ? (
                    <>
                      <span className="text-white/25"> · </span>
                      <span className="text-[#D6B36A]">
                        {supersetLabels[exercise.id]}
                      </span>
                    </>
                  ) : null}
                </p>
                <h2 className="mt-0.5 truncate text-[1.35rem] font-semibold leading-tight tracking-tight text-white sm:text-[1.65rem]">
                  {exercise.name}
                </h2>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {techniqueUrl ? (
                  <a
                    href={techniqueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-[#D6B36A]"
                    aria-label="Technika"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                <Link
                  href="/technique"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-[#D6B36A]"
                  aria-label="Nagraj technikę"
                >
                  <Video className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {targetBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex h-6 items-center rounded-full border border-[#D6B36A]/25 bg-[#D6B36A]/10 px-2 text-[11px] font-semibold tabular-nums text-[#E8C97A]"
                >
                  {badge}
                </span>
              ))}
            </div>

            {/* Pasek wykonanych serii — zielony = zaliczona */}
            <div className="mt-2.5">
              <div
                className="flex gap-1"
                role="tablist"
                aria-label="Postęp serii"
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
                      className={cn(
                        "h-2.5 min-w-0 flex-1 rounded-full transition",
                        completed
                          ? "bg-[#76D686] shadow-[0_0_12px_rgba(118,214,134,0.45)]"
                          : skipped
                            ? "bg-orange-400"
                            : active
                              ? "bg-[#D6B36A]/75 shadow-[0_0_10px_rgba(214,179,106,0.35)]"
                              : "bg-white/15 hover:bg-white/25",
                      )}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <p className="shrink-0 text-[12px] font-semibold tabular-nums text-white/75">
                  Seria {activeSetIndex + 1} z {exercise.sets.length}
                  {setCompleted
                    ? " · edycja"
                    : isSkippedWorkoutSet(set)
                      ? " · pominięta"
                      : ""}
                </p>
                {lastSetLine ? (
                  <p className="min-w-0 truncate text-right text-[11px] font-medium tabular-nums text-white/45">
                    {lastSetLine}
                    {lastWhen ? ` · ${lastWhen}` : ""}
                  </p>
                ) : null}
              </div>
            </div>

            <LiveCoachBanner
              tip={liveTip}
              onApply={applyLiveTip}
              className="mt-2 rounded-[16px] py-2"
              compact
            />

            <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                  className="rounded-lg border border-[#D6B36A]/35 bg-[#D6B36A]/10 px-2 py-1 text-[10px] font-semibold text-[#D6B36A]"
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
                  className="rounded-lg border border-white/12 px-2 py-1 text-[10px] text-white/55 hover:text-white"
                >
                  Usuń
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setNoteOpen((v) => !v)}
                className="rounded-lg border border-white/12 px-2 py-1 text-[10px] font-medium text-white/55 hover:text-white"
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
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/40 hover:text-white/70"
              >
                <Flag className="h-2.5 w-2.5" />
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

          {/* Ciężar / Powtórzenia rosną i wypełniają wolne miejsce pod akcjami. */}
          <div className="mt-2.5 flex min-h-0 flex-1 flex-col gap-2 min-[700px]:mt-3 min-[700px]:gap-2.5">
            <div className={premiumCardClass}>
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-white/55">
                <label htmlFor="set-weight">Ciężar</label>
                <span className="text-[10px] font-medium text-white/35">
                  krok {WEIGHT_STEP}
                </span>
              </div>
              {suggestedWeight != null &&
              set.weight <= 0 &&
              !(liveTip?.apply && liveTip.apply.weightKg > 0) ? (
                <button
                  type="button"
                  onClick={() => patchWeight(clampWeight(suggestedWeight))}
                  className="mt-1.5 inline-flex h-7 items-center rounded-full border border-[#D6B36A]/40 bg-[#D6B36A]/15 px-2 text-[10px] font-semibold text-[#D6B36A]"
                >
                  Sugestia {suggestedWeight} kg
                </button>
              ) : null}
              <div className="mt-2.5 flex items-center justify-center gap-2 min-[700px]:mt-3 min-[700px]:gap-2.5">
                <button
                  type="button"
                  aria-label="Zmniejsz ciężar"
                  onClick={() => {
                    patchWeight(
                      clampWeight(
                        (parseWeightInput(weightText) ?? set.weight) -
                          WEIGHT_STEP,
                      ),
                    );
                  }}
                  className={stepperBtnClass}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex min-w-0 flex-1 items-end justify-center gap-1">
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
                    className={cn(weightInputClass, "flex-1")}
                  />
                  <span className="mb-2 shrink-0 text-[13px] font-semibold lowercase tracking-wide text-[#D6B36A]/80 min-[700px]:mb-3 min-[700px]:text-[15px]">
                    kg
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Zwiększ ciężar"
                  onClick={() => {
                    patchWeight(
                      clampWeight(
                        (parseWeightInput(weightText) ?? set.weight) +
                          WEIGHT_STEP,
                      ),
                    );
                  }}
                  className={stepperBtnClass}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2.5 flex gap-2 min-[700px]:mt-3">
                <button
                  type="button"
                  onClick={() => {
                    patchWeight(
                      clampWeight(
                        (parseWeightInput(weightText) ?? set.weight) -
                          WEIGHT_FINE,
                      ),
                    );
                  }}
                  className={fineBtnClass}
                >
                  − 0,5
                </button>
                <button
                  type="button"
                  onClick={() => {
                    patchWeight(
                      clampWeight(
                        (parseWeightInput(weightText) ?? set.weight) +
                          WEIGHT_FINE,
                      ),
                    );
                  }}
                  className={fineBtnClass}
                >
                  + 0,5
                </button>
              </div>
            </div>

            <div className={premiumCardClass}>
              <div className="flex items-center justify-between text-[11px] font-semibold tracking-wide text-white/55">
                <label htmlFor="set-reps">Powtórzenia</label>
              </div>
              <div className="mt-2.5 flex flex-1 items-center justify-center gap-2 min-[700px]:mt-3 min-[700px]:gap-2.5">
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
                  <Minus className="h-4 w-4" />
                </button>
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
                  className={repsInputClass}
                />
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
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                RIR
              </p>
              <div className="mt-1 grid grid-cols-4 gap-1.5 min-[700px]:mt-1.5">
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
                        "h-9 rounded-[12px] text-[15px] font-bold tabular-nums transition active:scale-[0.97] min-[700px]:h-11 min-[700px]:rounded-[14px] min-[700px]:text-base sm:h-12",
                        active
                          ? "border border-[#F0D58A]/70 bg-gradient-to-b from-[#F0D58A] via-[#D6B36A] to-[#A8893F] text-black shadow-[0_0_24px_rgba(214,179,106,0.45)]"
                          : "border border-white/12 bg-[#0A0A0A] text-white/70 hover:border-[#D6B36A]/40",
                      )}
                    >
                      {v === 3 ? "3+" : v}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-black px-3.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:pt-2.5">
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
            "inline-flex h-14 w-full items-center justify-center gap-2 rounded-[22px] text-[15px] font-bold uppercase tracking-[0.06em] sm:h-[64px] sm:rounded-[24px] sm:text-[16px]",
            setCompleted
              ? "border border-[#76D686]/55 bg-[#76D686] text-[#0A1A0E] shadow-[0_0_36px_rgba(118,214,134,0.42)]"
              : "gym-btn-primary shadow-[0_0_36px_rgba(214,179,106,0.42)]",
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

        <div className="mt-1.5 grid grid-cols-4 gap-0.5 text-center text-[9px] font-semibold uppercase tracking-[0.06em] text-white/50 sm:mt-2 sm:text-[10px]">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={goPrev}
            className="min-h-10 rounded-lg px-0.5 py-1.5 transition hover:bg-white/[0.04] hover:text-white"
          >
            Wstecz
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={skipSet}
            disabled={!canZaliczyc && !(set.done && !isSkippedWorkoutSet(set))}
            className="min-h-10 rounded-lg px-0.5 py-1.5 transition hover:bg-white/[0.04] hover:text-white disabled:pointer-events-none disabled:opacity-25"
          >
            Pomiń
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
            className="min-h-10 rounded-lg px-0.5 py-1.5 transition hover:bg-white/[0.04] hover:text-white"
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
            className="min-h-10 rounded-lg px-0.5 py-1.5 font-bold text-[#D6B36A] transition hover:bg-[#D6B36A]/10 hover:text-[#F0D58A] disabled:opacity-50"
          >
            {finishPending ? "…" : "Zakończ"}
          </button>
        </div>

        {onDiscardSession ? (
          <button
            type="button"
            disabled={finishPending}
            onClick={() => {
              hapticTap();
              onDiscardSession();
            }}
            className="mt-0.5 inline-flex h-7 w-full items-center justify-center text-[10px] font-medium text-white/30 hover:text-white/55 disabled:opacity-50"
          >
            Bez zapisu
          </button>
        ) : null}
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
