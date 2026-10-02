"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Flag, Minus, Plus, X } from "lucide-react";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import { formatExerciseTargetLine, buildSupersetLabels } from "@/lib/start-workout-session";
import { requestActiveWorkoutCloudPush } from "@/lib/active-workout-persist";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import {
  SessionChromeHeader,
  SessionProgressBar,
} from "@/components/active-workout/session-chrome";
import {
  canCompleteWorkoutSet,
  findNextIncompleteExercise,
  isCompletedWorkoutSet,
  isSkippedWorkoutSet,
} from "@/lib/workout-skipped-sets";

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
}: GuidedSessionLayoutProps) {
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
    if (!set) return;
    setWeightText(set.weight > 0 ? String(set.weight) : "");
    const r = set.reps != null ? set.reps : (exercise?.targetReps ?? null);
    setRepsText(r != null && r > 0 ? String(r) : "");
  }, [exercise?.id, activeSetIndex, set?.weight, set?.reps, exercise?.targetReps]);

  const totals = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        total += 1;
        if (s.done) done += 1;
      }
    }
    return { done, total };
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
    const weight = parseWeightInput(weightText) ?? clampWeight(set.weight);
    const repsParsed = parseRepsInput(repsText);
    onPatchSet(exercise.id, activeSetIndex, {
      done: true,
      skipped: true,
      reps: repsParsed != null && repsParsed > 0 ? repsParsed : set.reps,
      weight,
      rir: set.rir ?? null,
    });
    requestActiveWorkoutCloudPush(true);
    setManualSetIndex(null);
    advanceAfterComplete(exercise.id, activeSetIndex);
  }

  function advanceAfterComplete(exerciseId: string, setIndex: number) {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const nextSet = setIndex + 1;
    if (nextSet < ex.sets.length) {
      setManualSetIndex(nextSet);
      return;
    }
    setManualSetIndex(null);
    const nextEx = findNextIncompleteExercise(exercises, exerciseId);
    if (nextEx) onSelectExercise(nextEx.id);
  }

  function completeSet() {
    if (!exercise || !set) return;
    const fromInput = parseRepsInput(repsText);
    const reps = clampReps(fromInput ?? set.reps ?? exercise.targetReps ?? 0);
    const weight = parseWeightInput(weightText) ?? clampWeight(set.weight);
    if (!canCompleteWorkoutSet(weight, reps > 0 ? reps : null)) {
      // Bez ciężaru / powtórzeń nie zaliczamy na zielono — użyj „Pomiń serię”.
      return;
    }
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
  const goalReps =
    exercise.targetReps != null && exercise.targetReps > 0
      ? exercise.targetReps
      : null;

  const inputClass =
    "h-14 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 text-center font-display text-4xl tabular-nums text-[var(--gym-gold)] outline-none transition focus:border-[var(--gym-gold)]/40 focus:ring-1 focus:ring-[var(--gym-gold)]/30";

  return (
    <div className="relative mx-auto w-full max-w-lg pb-8">
      <div className="sticky top-0 z-20 bg-[var(--gym-app-bg)]/95 backdrop-blur">
        <SessionChromeHeader
          title={title}
          subtitle={`${formatElapsed(elapsedSeconds)} · ${totals.done}/${totals.total} serii · zapis na bieżąco`}
          onClose={onCancelSession}
          onOpenList={() => {
            flushDraft();
            setListOpen(true);
          }}
          className="px-2 py-3 pt-3"
        />
        <SessionProgressBar progress={progress} />
      </div>

      <div className="px-4 pt-5">
        <h2 className="text-[1.65rem] font-semibold leading-tight text-white sm:text-3xl">
          {supersetLabels[exercise.id] ? (
            <span className="mr-2 text-[var(--gym-gold)]">
              {supersetLabels[exercise.id]}
            </span>
          ) : null}
          {exercise.name}
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-white/50">
          <span>{formatExerciseTargetLine(exercise)}</span>
          {techniqueUrl ? (
            <>
              <span className="text-white/25">·</span>
              <a
                href={techniqueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-[var(--gym-gold)] hover:underline"
              >
                technika ↗
              </a>
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => {
            const subject = encodeURIComponent(`Zgłoszenie ćwiczenia: ${exercise.name}`);
            const body = encodeURIComponent(
              `Ćwiczenie: ${exercise.name}\nPlan: ${title}\n\nOpis problemu:\n`,
            );
            window.location.href = `mailto:support@gymbrat.app?subject=${subject}&body=${body}`;
          }}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/55 hover:text-white/80"
        >
          <Flag className="h-3 w-3" />
          Zgłoś
        </button>

        <div className="mt-5 flex items-center gap-2.5">
          {exercise.sets.map((s, i) => {
            const completed = isCompletedWorkoutSet(s);
            const skipped = isSkippedWorkoutSet(s);
            return (
            <button
              key={i}
              type="button"
              aria-label={`Seria ${i + 1}${
                completed ? ", zaliczona" : skipped ? ", pominięta" : ""
              }`}
              aria-pressed={i === activeSetIndex}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSetIndex(i)}
              className={cn(
                "h-3.5 w-3.5 rounded-full transition",
                i === activeSetIndex
                  ? "bg-[var(--gym-gold)] ring-2 ring-[var(--gym-gold)]/45 ring-offset-2 ring-offset-black"
                  : completed
                    ? "bg-emerald-400"
                    : skipped
                      ? "bg-orange-400"
                      : "bg-white/20 hover:bg-white/35",
              )}
            />
            );
          })}
          <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Seria {activeSetIndex + 1} z {exercise.sets.length}
            {set && isCompletedWorkoutSet(set)
              ? " · edycja"
              : set && isSkippedWorkoutSet(set)
                ? " · pominięta"
                : ""}
          </span>
        </div>
        {goalReps != null ? (
          <p className="mt-2 text-sm text-white/45">Cel {goalReps} powt.</p>
        ) : (
          <p className="mt-2 text-sm text-white/35">Cel — powt.</p>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
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
              className="rounded-lg border border-white/12 px-2 py-1 text-[11px] text-white/60 hover:text-white"
            >
              Usuń ostatnią
            </button>
          ) : null}
          {onAddSet ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                flushDraft();
                const stayAt = activeSetIndex;
                onAddSet(exercise.id);
                // Nowa seria na końcu — nie przeskakuj z aktualnie wykonywanej.
                setManualSetIndex(stayAt);
              }}
              className="rounded-lg border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--gym-gold)]"
            >
              + Seria
            </button>
          ) : null}
        </div>

        <div className="mt-5 app-card p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/45">
            <label htmlFor="set-weight">Ciężar · kg</label>
            <span>krok 2,5</span>
          </div>
          {suggestedWeight != null && set.weight <= 0 ? (
            <button
              type="button"
              onClick={() => patchWeight(clampWeight(suggestedWeight))}
              className="mt-2 inline-flex h-9 items-center rounded-full border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/15 px-3 text-xs font-semibold text-[var(--gym-gold)]"
            >
              Sugestia {suggestedWeight} kg
            </button>
          ) : null}
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Zmniejsz ciężar"
              onClick={() => {
                patchWeight(
                  clampWeight((parseWeightInput(weightText) ?? set.weight) - 2.5),
                );
              }}
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-xl text-white"
            >
              <Minus className="h-5 w-5" />
            </button>
            <input
              id="set-weight"
              type="number"
              inputMode="decimal"
              step="0.5"
              min={0}
              max={999}
              value={weightText}
              placeholder={suggestedWeight != null ? String(suggestedWeight) : "0"}
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
                setWeightText(parsed != null && parsed > 0 ? String(parsed) : "");
              }}
              className={inputClass}
            />
            <button
              type="button"
              aria-label="Zwiększ ciężar"
              onClick={() => {
                patchWeight(
                  clampWeight((parseWeightInput(weightText) ?? set.weight) + 2.5),
                );
              }}
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-xl text-white"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                patchWeight(
                  clampWeight((parseWeightInput(weightText) ?? set.weight) - 0.5),
                );
              }}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/70"
            >
              − 0,5
            </button>
            <button
              type="button"
              onClick={() => {
                patchWeight(
                  clampWeight((parseWeightInput(weightText) ?? set.weight) + 0.5),
                );
              }}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/70"
            >
              + 0,5
            </button>
          </div>
        </div>

        <div className="mt-3 app-card p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/45">
            <label htmlFor="set-reps">Powtórzenia</label>
            <span>krok 1</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-3">
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
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-white"
            >
              <Minus className="h-5 w-5" />
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
                setRepsText(parsed != null && parsed > 0 ? String(parsed) : "");
              }}
              className={inputClass}
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
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-white"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
              W zapasie
            </p>
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
                      "h-11 rounded-xl text-sm font-bold tabular-nums transition",
                      active
                        ? "gold-btn"
                        : "border border-white/10 bg-[var(--gym-surface)] text-white/70 hover:border-[var(--gym-gold)]/40",
                    )}
                  >
                    {v === 3 ? "3+" : v}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNoteOpen((v) => !v)}
            className="mt-6 h-11 shrink-0 rounded-xl border border-white/12 px-3 text-xs font-medium text-white/70"
          >
            Notatka
          </button>
        </div>

        {noteOpen ? (
          <Textarea
            value={exercise.note ?? ""}
            onChange={(e) => onExerciseNoteChange?.(exercise.id, e.target.value)}
            placeholder="Notatka do ćwiczenia…"
            className="mt-3 min-h-[80px] border-white/12 bg-[var(--gym-surface)] text-white"
          />
        ) : null}

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
          className="gym-btn-primary mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold"
        >
          {set.done && !isSkippedWorkoutSet(set) ? (
            <>
              <Check className="h-5 w-5" />
              Zapisz zmiany serii
            </>
          ) : canZaliczyc ? (
            <>
              <Check className="h-5 w-5" />
              Zalicz serię
            </>
          ) : (
            <>
              <X className="h-5 w-5" />
              Pomiń serię
            </>
          )}
        </button>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs font-medium text-white/55">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={goPrev}
            className="px-1 py-2 hover:text-white"
          >
            ← Wstecz
          </button>
          {canZaliczyc || (set.done && !isSkippedWorkoutSet(set)) ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={skipSet}
              className="px-1 py-2 hover:text-white"
            >
              Pomiń serię
            </button>
          ) : (
            <span aria-hidden className="px-1 py-2 opacity-0">
              Pomiń serię
            </span>
          )}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              flushDraft();
              onDeferExercise?.();
              const next = findNextIncompleteExercise(
                exercises,
                exercise.id,
              );
              if (next) onSelectExercise(next.id);
            }}
            className="px-1 py-2 hover:text-white"
          >
            Wrócę później
          </button>
          <button
            type="button"
            disabled={finishPending}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              flushDraft();
              onFinishSession?.();
            }}
            className="px-1 py-2 font-semibold text-[var(--gym-gold)] hover:text-[var(--gym-gold-bright)] disabled:opacity-50"
          >
            {finishPending ? "Zapis…" : "Zakończ"}
          </button>
        </div>

        {onDiscardSession ? (
          <button
            type="button"
            disabled={finishPending}
            onClick={onDiscardSession}
            className="mt-3 inline-flex h-10 w-full items-center justify-center text-xs font-medium text-white/40 hover:text-white/70 disabled:opacity-50"
          >
            Zakończ bez zapisu
          </button>
        ) : null}
      </div>

      {listOpen ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black">
          <header className="flex items-start justify-between px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]">
                Lista ćwiczeń
              </p>
              <h3 className="mt-1 text-3xl font-semibold text-white">{title}</h3>
            </div>
            <button
              type="button"
              onClick={() => setListOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12"
              aria-label="Zamknij"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="mx-3 mb-4 min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#141414]">
            <ul className="h-full overflow-y-auto px-2 py-2">
              {exercises.map((ex, i) => {
                const doneAll = ex.sets.every((s) => isCompletedWorkoutSet(s));
                const active = ex.id === exercise.id;
                const nameClass = doneAll
                  ? "text-emerald-400"
                  : active
                    ? "text-[var(--gym-gold)]"
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
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-4 text-left hover:bg-white/[0.03]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[16px] font-semibold", nameClass)}>
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
