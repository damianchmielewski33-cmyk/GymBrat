"use client";

import { useMemo, useState } from "react";
import { Check, List, Minus, Plus, X } from "lucide-react";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import { formatExerciseTargetLine } from "@/lib/start-workout-session";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

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

type GuidedSessionLayoutProps = {
  title: string;
  elapsedSeconds: number;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  listOpen?: boolean;
  onListOpenChange?: (open: boolean) => void;
  onSelectExercise: (id: string) => void;
  onPatchSet: (exerciseId: string, setIndex: number, patch: Partial<WorkoutSetState>) => void;
  onExerciseNoteChange?: (exerciseId: string, note: string) => void;
  onCancelSession?: () => void;
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
  onExerciseNoteChange,
  onCancelSession,
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

  const selectedIndex = Math.max(
    0,
    exercises.findIndex((e) => e.id === selectedExerciseId),
  );
  const exercise = exercises[selectedIndex] ?? exercises[0] ?? null;

  const activeSetIndex = useMemo(() => {
    if (!exercise) return 0;
    const firstOpen = exercise.sets.findIndex((s) => !s.done);
    return firstOpen >= 0 ? firstOpen : Math.max(0, exercise.sets.length - 1);
  }, [exercise]);

  const set = exercise?.sets[activeSetIndex] ?? null;

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

  function goPrev() {
    if (!exercise) return;
    if (activeSetIndex > 0) {
      onPatchSet(exercise.id, activeSetIndex - 1, { done: false });
      return;
    }
    if (selectedIndex > 0) {
      onSelectExercise(exercises[selectedIndex - 1]!.id);
    }
  }

  function skipSet() {
    if (!exercise || !set) return;
    onPatchSet(exercise.id, activeSetIndex, {
      done: true,
      reps: set.reps,
      weight: set.weight,
      rir: set.rir ?? null,
    });
    advanceAfterComplete(exercise.id, activeSetIndex);
  }

  function advanceAfterComplete(exerciseId: string, setIndex: number) {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const nextSet = setIndex + 1;
    if (nextSet < ex.sets.length) return;
    const idx = exercises.findIndex((e) => e.id === exerciseId);
    const nextEx = exercises[idx + 1];
    if (nextEx) onSelectExercise(nextEx.id);
  }

  function completeSet() {
    if (!exercise || !set) return;
    const reps = clampReps(set.reps ?? exercise.targetReps ?? 8);
    onPatchSet(exercise.id, activeSetIndex, {
      done: true,
      reps: reps > 0 ? reps : 1,
      weight: clampWeight(set.weight),
      rir: set.rir ?? null,
    });
    advanceAfterComplete(exercise.id, activeSetIndex);
  }

  if (!exercise || !set) {
    return (
      <div className="px-4 py-16 text-center text-sm text-white/50">
        Brak ćwiczeń w sesji.
      </div>
    );
  }

  const repsDisplay = set.reps != null ? set.reps : (exercise.targetReps ?? 0);
  const rirValue = set.rir ?? exercise.targetRir ?? 1;
  const progress =
    totals.total > 0 ? Math.min(1, totals.done / totals.total) : 0;

  return (
    <div className="relative mx-auto w-full max-w-lg pb-8">
      <div
        className="h-1 w-full bg-white/10"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-[var(--gym-gold)] transition-[width] duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-black/95 px-2 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onCancelSession}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-white/80"
          aria-label="Zamknij sesję"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 text-center">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            {title}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-white/70">
            {formatElapsed(elapsedSeconds)} · {totals.done}/{totals.total} serii
          </p>
        </div>
        <button
          type="button"
          onClick={() => setListOpen(true)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-white/80"
          aria-label="Lista ćwiczeń"
        >
          <List className="h-4 w-4" />
        </button>
      </header>

      <div className="px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
            Ćwiczenie {selectedIndex + 1} z {exercises.length} · LP {selectedIndex + 1}
          </p>
          <button
            type="button"
            onClick={() => setListOpen(true)}
            className="text-xs font-medium text-[var(--gym-gold)]"
          >
            zmień
          </button>
        </div>
        <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">{exercise.name}</h2>
        <p className="mt-1 font-mono text-xs text-white/45">
          {formatExerciseTargetLine(exercise)}
        </p>

        <div className="mt-4 flex items-center gap-2">
          {exercise.sets.map((s, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 flex-1 rounded-full",
                s.done || i === activeSetIndex
                  ? "bg-[var(--gym-gold)]"
                  : "bg-white/15",
              )}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-white/55">
          <span className="font-semibold uppercase tracking-wide">
            Seria {activeSetIndex + 1} z {exercise.sets.length}
          </span>
          {exercise.targetReps != null ? (
            <span>Cel {exercise.targetReps} powt.</span>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#161616] p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/45">
            <span>Ciężar · kg</span>
            <span>krok 2,5</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Zmniejsz ciężar"
              onClick={() =>
                onPatchSet(exercise.id, activeSetIndex, {
                  weight: clampWeight(set.weight - 2.5),
                  done: false,
                })
              }
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-xl text-white"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="min-w-[4.5rem] text-center font-display text-4xl tabular-nums text-white">
              {set.weight}
            </span>
            <button
              type="button"
              aria-label="Zwiększ ciężar"
              onClick={() =>
                onPatchSet(exercise.id, activeSetIndex, {
                  weight: clampWeight(set.weight + 2.5),
                  done: false,
                })
              }
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-xl text-white"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                onPatchSet(exercise.id, activeSetIndex, {
                  weight: clampWeight(set.weight - 0.5),
                  done: false,
                })
              }
              className="h-10 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/70"
            >
              − 0,5
            </button>
            <button
              type="button"
              onClick={() =>
                onPatchSet(exercise.id, activeSetIndex, {
                  weight: clampWeight(set.weight + 0.5),
                  done: false,
                })
              }
              className="h-10 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/70"
            >
              + 0,5
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#161616] p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/45">
            <span>Powtórzenia</span>
            <span>krok 1</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Mniej powtórzeń"
              onClick={() =>
                onPatchSet(exercise.id, activeSetIndex, {
                  reps: Math.max(0, clampReps(repsDisplay) - 1),
                  done: false,
                })
              }
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-white"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="min-w-[4.5rem] text-center font-display text-4xl tabular-nums text-[var(--gym-gold)]">
              {repsDisplay}
            </span>
            <button
              type="button"
              aria-label="Więcej powtórzeń"
              onClick={() =>
                onPatchSet(exercise.id, activeSetIndex, {
                  reps: Math.min(99, clampReps(repsDisplay) + 1),
                  done: false,
                })
              }
              className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] text-white"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-white/45">
              W zapasie
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((v) => {
                const active = rirValue === v || (v === 3 && (rirValue ?? 0) >= 3);
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() =>
                      onPatchSet(exercise.id, activeSetIndex, {
                        rir: v,
                        done: false,
                      })
                    }
                    className={cn(
                      "h-11 rounded-xl text-sm font-semibold tabular-nums",
                      active
                        ? "bg-[var(--gym-gold)] text-[var(--neon-fg)]"
                        : "border border-white/10 bg-[#161616] text-white/70",
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
            className="mt-3 min-h-[80px] border-white/12 bg-[#161616] text-white"
          />
        ) : null}

        <button
          type="button"
          onClick={completeSet}
          className="gold-btn mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold"
        >
          <Check className="h-5 w-5" />
          Zalicz serię
        </button>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-white/55">
          <button type="button" onClick={goPrev} className="px-1 py-2 hover:text-white">
            ← Wstecz
          </button>
          <button type="button" onClick={skipSet} className="px-1 py-2 hover:text-white">
            Pomiń serię
          </button>
          <button
            type="button"
            onClick={() => {
              onDeferExercise?.();
              const next = exercises[selectedIndex + 1];
              if (next) onSelectExercise(next.id);
            }}
            className="px-1 py-2 hover:text-white"
          >
            Wrócę później
          </button>
          <button
            type="button"
            disabled={finishPending}
            onClick={onFinishSession}
            className="px-1 py-2 text-[var(--gym-gold)] hover:text-[var(--gym-gold-bright)] disabled:opacity-50"
          >
            {finishPending ? "Zapis…" : "Zakończ"}
          </button>
        </div>
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
                const doneAll = ex.sets.every((s) => s.done);
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
                      onClick={() => {
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
                              s.done
                                ? "bg-emerald-400"
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
