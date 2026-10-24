"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Play } from "lucide-react";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import { Button } from "@/components/ui/button";
import { GhostPickerSheet } from "@/components/active-workout/ghost-picker-sheet";
import { useGhostRaceTicker } from "@/components/active-workout/ghost-race-hud";
import { RirPicker } from "@/components/active-workout/rir-picker";
import { SessionChromeHeader } from "@/components/active-workout/session-chrome";
import { SessionMenuSheet } from "@/components/active-workout/session-menu-sheet";
import { SetMetricField } from "@/components/active-workout/set-metric-field";
import { SetPills } from "@/components/active-workout/set-pills";
import { SetSuggestionRow } from "@/components/active-workout/set-suggestion-row";
import {
  formatExerciseSchemeParts,
  formatRepTarget,
  primarySetActionLabel,
} from "@/lib/active-workout-copy";
import { hapticTap } from "@/lib/haptics";
import { formatKgPl, resolveRepRange } from "@/lib/set-progression-suggestion";
import { buildSetSuggestionView } from "@/lib/set-suggestion-view";
import { buildSupersetLabels } from "@/lib/start-workout-session";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { resolveWeightStep } from "@/lib/weight-step";
import { buildSessionProgress } from "@/lib/workout-session-progress";
import {
  MAX_REPS,
  MAX_WEIGHT_KG,
  clampReps,
  clampWeight,
  findPreviousCompletedSet,
  parseRepsInput,
  parseWeightInput,
  resolveInitialSetDraft,
  resolveWeightAdjustSteps,
} from "@/lib/workout-set-draft";
import {
  findNextIncompleteExercise,
  hasPerformedReps,
  isSkippedWorkoutSet,
  resolveAdvanceAfterSet,
  resolveSetSaveIssue,
} from "@/lib/workout-skipped-sets";
import { cn } from "@/lib/utils";

/** Po zapisie przycisk główny ignoruje dotknięcia (US-8: drugie tapnięcie nie zapisze następnej serii). */
const SAVE_TAP_GUARD_MS = 700;

const linkClass =
  "min-h-11 rounded-lg px-1 text-[14px] font-semibold text-white/82 transition hover:bg-white/[0.04] hover:text-white disabled:pointer-events-none disabled:opacity-38";

const quickBtnClass =
  "-my-2.5 inline-flex h-11 items-center";

const quickChipClass =
  "inline-flex h-8 min-w-14 items-center justify-center rounded-full border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/8 px-2.5 text-[13px] font-semibold tabular-nums text-[var(--gym-gold)]";

type ManualSet = { exerciseId: string; setIndex: number };
type SaveIssueState = { weight: boolean; reps: boolean };
type SyncedSet = { weight: number; reps: number | null; done: boolean };

function weightToInput(kg: number | null): string {
  return kg != null && kg > 0 ? String(kg) : "";
}

function repsToInput(reps: number | null | undefined): string {
  return reps != null && reps > 0 ? String(reps) : "";
}

function supersetLetter(label: string | undefined): string | null {
  if (!label) return null;
  const letter = label.replace(/\d+$/, "");
  return letter || label;
}

type GuidedSessionLayoutProps = {
  title: string;
  elapsedSeconds: number;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onSelectExercise: (id: string) => void;
  onPatchSet: (exerciseId: string, setIndex: number, patch: Partial<WorkoutSetState>) => void;
  onAddSet?: (exerciseId: string) => number | null | void;
  onRemoveLastSet?: (exerciseId: string) => number | null | void;
  onExerciseNoteChange?: (exerciseId: string, note: string) => void;
  onCancelSession?: () => void;
  onFinishSession?: () => void;
  finishPending?: boolean;
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
  menuOpen,
  onMenuOpenChange,
  onSelectExercise,
  onPatchSet,
  onAddSet,
  onRemoveLastSet,
  onExerciseNoteChange,
  onCancelSession,
  onFinishSession,
  finishPending,
  focusSetRequest,
  onFocusSetHandled,
}: GuidedSessionLayoutProps) {
  const workoutPlanId = useActiveWorkoutStore((s) => s.workoutPlanId);
  useGhostRaceTicker();

  /** Ręczny wybór serii (null albo inne ćwiczenie = pierwsza niedokończona). */
  const [manual, setManual] = useState<ManualSet | null>(null);
  const [handledFocusNonce, setHandledFocusNonce] = useState<number | null>(null);
  const [weightText, setWeightText] = useState("");
  const [repsText, setRepsText] = useState("");
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [synced, setSynced] = useState<SyncedSet | null>(null);
  const [saveIssue, setSaveIssue] = useState<SaveIssueState | null>(null);
  const weightInputRef = useRef<HTMLInputElement>(null);
  const repsInputRef = useRef<HTMLInputElement>(null);
  const saveGuardUntilRef = useRef(0);

  const selectedIndex = Math.max(
    0,
    exercises.findIndex((e) => e.id === selectedExerciseId),
  );
  const exercise = exercises[selectedIndex] ?? null;

  if (
    focusSetRequest &&
    exercise &&
    focusSetRequest.exerciseId === exercise.id &&
    focusSetRequest.nonce !== handledFocusNonce
  ) {
    setHandledFocusNonce(focusSetRequest.nonce);
    setManual({
      exerciseId: exercise.id,
      setIndex: Math.max(0, Math.min(exercise.sets.length - 1, focusSetRequest.setIndex)),
    });
  }

  useEffect(() => {
    if (focusSetRequest && focusSetRequest.nonce === handledFocusNonce) {
      onFocusSetHandled?.();
    }
  }, [focusSetRequest, handledFocusNonce, onFocusSetHandled]);

  const autoSetIndex = useMemo(() => {
    if (!exercise) return 0;
    const firstOpen = exercise.sets.findIndex((s) => !s.done);
    return firstOpen >= 0 ? firstOpen : Math.max(0, exercise.sets.length - 1);
  }, [exercise]);

  const activeSetIndex =
    exercise &&
    manual &&
    manual.exerciseId === exercise.id &&
    manual.setIndex >= 0 &&
    manual.setIndex < exercise.sets.length
      ? manual.setIndex
      : autoSetIndex;

  const set = exercise?.sets[activeSetIndex] ?? null;
  const lastSessionSet = exercise?.lastSessionSets?.[activeSetIndex] ?? null;

  const suggestion = useMemo(
    () => (exercise ? buildSetSuggestionView(exercise, activeSetIndex) : null),
    [exercise, activeSetIndex],
  );
  const progress = useMemo(
    () =>
      buildSessionProgress(
        exercises,
        exercise ? { exerciseId: exercise.id, setIndex: activeSetIndex } : null,
      ),
    [exercises, exercise, activeSetIndex],
  );
  const supersetLabels = useMemo(() => buildSupersetLabels(exercises), [exercises]);
  const adjustSteps = useMemo(
    () =>
      resolveWeightAdjustSteps(
        resolveWeightStep({
          name: exercise?.name,
          explicitStepKg: exercise?.weightStepKg,
        }),
      ),
    [exercise?.name, exercise?.weightStepKg],
  );

  /*
   * D3 (ADR 0003): wartość początkowa liczona przy wejściu na serię, tylko w polach
   * (bez zapisu do store i bez pushu). Klucz obejmuje obecność historii, żeby podpowiedzi
   * wczytane po starcie sesji też wypełniły pole. Przy tym samym kluczu pola przyjmują
   * zmiany ze store (drugie urządzenie) tylko dla serii zapisanej albo wartości > 0.
   */
  const hintsReady = exercise?.lastSessionSets != null || exercise?.suggestedWeights != null;
  const setKey = exercise && set ? `${exercise.id}:${activeSetIndex}:${hintsReady ? 1 : 0}` : null;
  if (exercise && set && setKey !== draftKey) {
    const initial = resolveInitialSetDraft({
      set,
      suggestion,
      lastSessionSet,
      previousSessionSet: findPreviousCompletedSet(exercise.sets, activeSetIndex),
    });
    setDraftKey(setKey);
    setWeightText(weightToInput(initial.weightKg));
    setRepsText(repsToInput(initial.reps));
    setSynced({ weight: set.weight, reps: set.reps, done: set.done });
    setSaveIssue(null);
  } else if (
    set &&
    synced &&
    (set.weight !== synced.weight || set.reps !== synced.reps || set.done !== synced.done)
  ) {
    setSynced({ weight: set.weight, reps: set.reps, done: set.done });
    if ((set.done || set.weight > 0) && parseWeightInput(weightText) !== set.weight) {
      setWeightText(weightToInput(set.weight));
    }
    if ((set.done || hasPerformedReps(set.reps)) && parseRepsInput(repsText) !== set.reps) {
      setRepsText(repsToInput(set.reps));
    }
  }

  function draftValues() {
    const weight = parseWeightInput(weightText) ?? 0;
    const repsParsed = parseRepsInput(repsText);
    return { weight, reps: repsParsed != null && repsParsed > 0 ? repsParsed : null };
  }

  /** Pola do store bez zmiany statusu serii; bez zmian wartości nic nie wysyła. */
  function flushDraft() {
    if (!exercise || !set) return;
    const { weight, reps } = draftValues();
    if (weight === set.weight && reps === set.reps) return;
    onPatchSet(exercise.id, activeSetIndex, {
      weight,
      reps,
      done: set.done,
    });
  }

  function patchValues(values: { weight?: number; reps?: number | null }) {
    if (!exercise || !set) return;
    if (values.weight !== undefined) setWeightText(weightToInput(values.weight));
    if (values.reps !== undefined) setRepsText(repsToInput(values.reps));
    setSaveIssue((prev) => {
      if (!prev) return prev;
      const next = {
        weight: prev.weight && !(values.weight != null && values.weight > 0),
        reps: prev.reps && !hasPerformedReps(values.reps),
      };
      return next.weight || next.reps ? next : null;
    });
    onPatchSet(exercise.id, activeSetIndex, {
      ...values,
      done: set.done,
    });
  }

  function selectSetIndex(nextIndex: number) {
    if (!exercise || nextIndex === activeSetIndex) return;
    flushDraft();
    setManual({ exerciseId: exercise.id, setIndex: nextIndex });
  }

  function goToExercise(exerciseId: string, setIndex: number | null) {
    setManual(setIndex != null ? { exerciseId, setIndex } : null);
    onSelectExercise(exerciseId);
  }

  function advanceAfterComplete(exerciseId: string, setIndex: number) {
    // Po patchu bierz świeży stan ze store — props `exercises` jest jeszcze stary.
    const exercisesNow = useActiveWorkoutStore.getState().exercises;
    const target = resolveAdvanceAfterSet(exercisesNow, exerciseId, setIndex);
    if (!target) {
      setManual(null);
      return;
    }
    if (target.exerciseId === exerciseId) {
      setManual({ exerciseId, setIndex: target.setIndex });
      return;
    }
    goToExercise(target.exerciseId, target.setIndex);
  }

  function goPrev() {
    if (!exercise) return;
    hapticTap();
    flushDraft();
    if (activeSetIndex > 0) {
      setManual({ exerciseId: exercise.id, setIndex: activeSetIndex - 1 });
      return;
    }
    const prev = exercises[selectedIndex - 1];
    if (prev) goToExercise(prev.id, Math.max(0, prev.sets.length - 1));
  }

  function deferExercise() {
    if (!exercise) return;
    hapticTap();
    flushDraft();
    const next = findNextIncompleteExercise(exercises, exercise.id);
    if (next) onSelectExercise(next.id);
  }

  function skipSet() {
    if (!exercise || !set) return;
    hapticTap();
    const { weight, reps } = draftValues();
    onPatchSet(exercise.id, activeSetIndex, {
      done: true,
      skipped: true,
      reps,
      weight,
      rir: set.rir ?? null,
    });
    advanceAfterComplete(exercise.id, activeSetIndex);
  }

  function saveSet() {
    if (!exercise || !set) return;
    if (Date.now() < saveGuardUntilRef.current) return;
    const { weight, reps } = draftValues();
    const issue = resolveSetSaveIssue(weight, reps);
    if (issue) {
      setSaveIssue({ weight: issue === "weight", reps: !hasPerformedReps(reps) });
      (issue === "weight" ? weightInputRef : repsInputRef).current?.focus();
      return;
    }
    saveGuardUntilRef.current = Date.now() + SAVE_TAP_GUARD_MS;
    hapticTap();
    onPatchSet(exercise.id, activeSetIndex, {
      done: true,
      skipped: false,
      reps,
      weight,
      rir: set.rir ?? null,
    });
    advanceAfterComplete(exercise.id, activeSetIndex);
  }

  function closeMenu() {
    onMenuOpenChange(false);
  }

  if (!exercise || !set) {
    return (
      <div className="px-4 py-16 text-center text-sm text-[var(--gym-text-secondary)]">
        Brak ćwiczeń w sesji.
      </div>
    );
  }

  const currentExercise = exercise;
  const currentSet = set;
  const group = progress.groups[selectedIndex];
  const setCompleted = set.done && !isSkippedWorkoutSet(set);
  const setOrdinal = activeSetIndex + 1;
  const techniqueUrl = exercise.techniqueYoutubeUrl?.trim() || null;
  const superset = supersetLetter(supersetLabels[exercise.id]);
  const schemeParts = formatExerciseSchemeParts({
    sets: exercise.targetSets ?? exercise.sets.length,
    targetReps: exercise.targetReps,
    targetRir: exercise.targetRir,
    tempo: exercise.tempo,
  });

  const repRange = resolveRepRange(exercise.targetReps);
  const repTarget = formatRepTarget(exercise.targetReps);
  const repsNow = parseRepsInput(repsText);
  const repsInTarget =
    repRange != null &&
    repsNow != null &&
    repsNow >= repRange.min &&
    repsNow <= repRange.max;

  const { weight: draftWeight, reps: draftReps } = draftValues();
  const suggestionApplied =
    suggestion != null &&
    draftWeight === suggestion.weightKg &&
    (suggestion.reps == null || draftReps === suggestion.reps);

  const stepLabel = formatKgPl(adjustSteps.stepperKg);
  const quickLabel = formatKgPl(adjustSteps.quickKg);
  const isFirstSet = selectedIndex === 0 && activeSetIndex === 0;

  function adjustWeight(deltaKg: number) {
    patchValues({ weight: clampWeight(draftWeight + deltaKg) });
  }

  function adjustReps(delta: number) {
    const next = clampReps((repsNow ?? 0) + delta);
    patchValues({ reps: next > 0 ? next : null });
  }

  function onWeightInput(raw: string) {
    setWeightText(raw);
    const parsed = parseWeightInput(raw);
    if (parsed != null && parsed > 0) {
      setSaveIssue((prev) => (prev && prev.reps ? { weight: false, reps: true } : null));
    }
    if (parsed != null || raw.trim() === "") {
      onPatchSet(currentExercise.id, activeSetIndex, {
        weight: parsed ?? 0,
        done: currentSet.done,
      });
    }
  }

  function onRepsInput(raw: string) {
    setRepsText(raw);
    const parsed = parseRepsInput(raw);
    if (hasPerformedReps(parsed)) {
      setSaveIssue((prev) => (prev && prev.weight ? { weight: true, reps: false } : null));
    }
    if (parsed != null || raw.trim() === "") {
      onPatchSet(currentExercise.id, activeSetIndex, {
        reps: parsed != null && parsed > 0 ? parsed : null,
        done: currentSet.done,
      });
    }
  }

  function reportProblem() {
    const subject = encodeURIComponent(`Zgłoszenie ćwiczenia: ${currentExercise.name}`);
    const body = encodeURIComponent(
      `Ćwiczenie: ${currentExercise.name}\nPlan: ${title}\n\nOpis problemu:\n`,
    );
    closeMenu();
    window.location.href = `mailto:support@gymbrat.app?subject=${subject}&body=${body}`;
  }

  return (
    <div className="relative mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden bg-[var(--gym-black)] text-white">
      <SessionChromeHeader
        title={title}
        elapsedSeconds={elapsedSeconds}
        progress={progress}
        badge={<GhostPickerSheet planId={workoutPlanId} />}
        onClose={onCancelSession}
        onOpenMenu={() => {
          flushDraft();
          onMenuOpenChange(true);
        }}
      />

      {/* Środek: przy budżecie z UX 4.3 bez przewijania; przewijanie tylko awaryjnie (powiększenie tekstu). */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3 [scrollbar-width:none] compact:gap-2 compact:py-2 [&::-webkit-scrollbar]:hidden">
        <section>
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase leading-[14px] tracking-[0.16em] text-[var(--gym-gold)]">
                Ćwiczenie {selectedIndex + 1} z {exercises.length}
                {superset ? ` · Superseria ${superset}` : null}
              </p>
              <h2
                className="mt-1 truncate font-heading text-[22px] font-semibold leading-[26px] text-white compact:mt-0.5 compact:text-[20px] compact:leading-6"
                title={exercise.name}
              >
                {exercise.name}
              </h2>
            </div>
            {techniqueUrl ? (
              <a
                href={techniqueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-[var(--gym-gold)]"
                aria-label={`Film techniki: ${exercise.name}`}
              >
                <Play className="size-4" />
              </a>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 compact:mt-0.5">
            <p className="whitespace-nowrap text-[13px] tabular-nums text-[var(--gym-text-secondary)]">
              <span className="font-semibold text-white">{schemeParts[0]}</span>
              {schemeParts.slice(1).map((part) => (
                <span key={part}> · {part}</span>
              ))}
            </p>
            {group ? (
              <SetPills
                segments={group.segments}
                sets={exercise.sets}
                activeSetIndex={activeSetIndex}
                onSelect={selectSetIndex}
              />
            ) : null}
          </div>
        </section>

        <SetSuggestionRow
          suggestion={suggestion}
          lastSet={lastSessionSet}
          daysSinceLastSession={exercise.coachContext?.daysSinceLastSession}
          applied={suggestionApplied}
          onApplyLast={
            lastSessionSet
              ? () => {
                  hapticTap();
                  patchValues({
                    weight: clampWeight(Number(lastSessionSet.weight) || 0),
                    ...(hasPerformedReps(lastSessionSet.reps)
                      ? { reps: clampReps(lastSessionSet.reps) }
                      : {}),
                  });
                }
              : undefined
          }
          onApplySuggestion={
            suggestion
              ? () => {
                  hapticTap();
                  patchValues({
                    weight: clampWeight(suggestion.weightKg),
                    ...(suggestion.reps != null ? { reps: clampReps(suggestion.reps) } : {}),
                  });
                }
              : undefined
          }
        />

        <SetMetricField
          id="set-weight"
          label="Ciężar"
          labelMeta={`· krok ${stepLabel} kg`}
          value={weightText}
          onValueChange={onWeightInput}
          onBlur={flushDraft}
          inputMode="decimal"
          step={adjustSteps.stepperKg}
          max={MAX_WEIGHT_KG}
          unit="kg"
          accent
          inputRef={weightInputRef}
          error={saveIssue?.weight ? "Podaj ciężar" : null}
          onDecrement={() => adjustWeight(-adjustSteps.stepperKg)}
          onIncrement={() => adjustWeight(adjustSteps.stepperKg)}
          decrementLabel={`Zmniejsz ciężar o ${stepLabel} kg`}
          incrementLabel={`Zwiększ ciężar o ${stepLabel} kg`}
          headerSlot={
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() => adjustWeight(-adjustSteps.quickKg)}
                aria-label={`Zmniejsz ciężar o ${quickLabel} kg`}
                className={quickBtnClass}
              >
                <span className={quickChipClass}>−{quickLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => adjustWeight(adjustSteps.quickKg)}
                aria-label={`Zwiększ ciężar o ${quickLabel} kg`}
                className={quickBtnClass}
              >
                <span className={quickChipClass}>+{quickLabel}</span>
              </button>
            </span>
          }
        />

        <SetMetricField
          id="set-reps"
          label="Powtórzenia"
          value={repsText}
          onValueChange={onRepsInput}
          onBlur={flushDraft}
          inputMode="numeric"
          step={1}
          max={MAX_REPS}
          inputRef={repsInputRef}
          error={saveIssue?.reps ? "Podaj liczbę powtórzeń" : null}
          onDecrement={() => adjustReps(-1)}
          onIncrement={() => adjustReps(1)}
          decrementLabel="Mniej powtórzeń"
          incrementLabel="Więcej powtórzeń"
          headerSlot={
            repTarget ? (
              <span
                className={cn(
                  "text-[12px] font-semibold tabular-nums",
                  repsInTarget
                    ? "text-[var(--gym-gold-bright)]"
                    : "text-[var(--gym-text-secondary)]",
                )}
              >
                {repsInTarget ? `✓ w celu ${repTarget}` : `cel ${repTarget}`}
              </span>
            ) : null
          }
        />

        <RirPicker
          value={set.rir ?? exercise.targetRir ?? null}
          targetRir={exercise.targetRir ?? null}
          onChange={(rir) =>
            onPatchSet(exercise.id, activeSetIndex, {
              rir,
              done: set.done,
            })
          }
        />
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-[var(--gym-black)] px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 compact:pb-[max(0.25rem,env(safe-area-inset-bottom))] compact:pt-2">
        <Button
          type="button"
          variant="cta"
          // Blur pola przed kliknięciem nie może zepsuć zapisu (patrz `flushDraft`).
          onMouseDown={(e) => e.preventDefault()}
          onClick={saveSet}
          className="h-14 w-full gap-2 text-[17px] compact:h-[52px]"
        >
          <Check className="size-5" strokeWidth={2.5} />
          {primarySetActionLabel(setOrdinal, setCompleted)}
        </Button>

        <div className="mt-1 grid grid-cols-3 text-center">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={goPrev}
            disabled={isFirstSet}
            aria-label="Wstecz, wróć do poprzedniej serii"
            className={linkClass}
          >
            Wstecz
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={deferExercise}
            aria-label="Później, odłóż ćwiczenie na później"
            className={linkClass}
          >
            Później
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={skipSet}
            disabled={setCompleted}
            aria-label={`Pomiń serię ${setOrdinal}`}
            className={linkClass}
          >
            Pomiń
          </button>
        </div>
      </div>

      <SessionMenuSheet
        open={menuOpen}
        onOpenChange={onMenuOpenChange}
        title={title}
        exercises={exercises}
        progress={progress}
        currentExerciseId={exercise.id}
        onSelectExercise={(id) => {
          flushDraft();
          onSelectExercise(id);
          closeMenu();
        }}
        onAddSet={
          onAddSet
            ? () => {
                flushDraft();
                onAddSet(currentExercise.id);
                setManual({ exerciseId: currentExercise.id, setIndex: activeSetIndex });
                closeMenu();
              }
            : undefined
        }
        onRemoveLastSet={
          onRemoveLastSet && exercise.sets.length > 1
            ? () => {
                flushDraft();
                const nextIndex = onRemoveLastSet(currentExercise.id);
                setManual(
                  typeof nextIndex === "number"
                    ? { exerciseId: currentExercise.id, setIndex: nextIndex }
                    : null,
                );
                closeMenu();
              }
            : undefined
        }
        note={exercise.note ?? ""}
        onNoteChange={
          onExerciseNoteChange
            ? (note) => onExerciseNoteChange(currentExercise.id, note)
            : undefined
        }
        onReportProblem={reportProblem}
        onFinish={
          onFinishSession
            ? () => {
                hapticTap();
                flushDraft();
                closeMenu();
                onFinishSession();
              }
            : undefined
        }
        finishPending={finishPending}
      />
    </div>
  );
}
