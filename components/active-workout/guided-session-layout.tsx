"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, List, Minus, Plus, X } from "lucide-react";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import { formatExerciseTargetLine, buildSupersetLabels } from "@/lib/start-workout-session";
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
  onAddSet?: (exerciseId: string) => void;
  onRemoveLastSet?: (exerciseId: string) => void;
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
  onAddSet,
  onRemoveLastSet,
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
  /** Ręczny wybór serii (null = pierwsza niedokończona). */
  const [manualSetIndex, setManualSetIndex] = useState<number | null>(null);
  const [weightText, setWeightText] = useState("");
  const [repsText, setRepsText] = useState("");

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

  useEffect(() => {
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

  function goPrev() {
    if (!exercise) return;
    if (activeSetIndex > 0) {
      setManualSetIndex(activeSetIndex - 1);
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
    const idx = exercises.findIndex((e) => e.id === exerciseId);
    const nextEx = exercises[idx + 1];
    if (nextEx) onSelectExercise(nextEx.id);
  }

  function completeSet() {
    if (!exercise || !set) return;
    const fromInput = parseRepsInput(repsText);
    const reps = clampReps(fromInput ?? set.reps ?? exercise.targetReps ?? 8);
    const weight = parseWeightInput(weightText) ?? clampWeight(set.weight);
    onPatchSet(exercise.id, activeSetIndex, {
      done: true,
      reps: reps > 0 ? reps : 1,
      weight,
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

  const rirValue = set.rir ?? exercise.targetRir ?? 1;
  const progress = totals.total > 0 ? Math.min(1, totals.done / totals.total) : 0;

  const inputClass =
    "h-14 min-w-0 flex-1 rounded-xl border border-[var(--gym-gold)]/35 bg-black/50 px-2 text-center font-display text-4xl tabular-nums text-white outline-none transition focus:border-[var(--gym-gold)] focus:ring-2 focus:ring-[var(--gym-gold)]/35";

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
        <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">
          {supersetLabels[exercise.id] ? (
            <span className="mr-2 text-[var(--gym-gold)]">
              {supersetLabels[exercise.id]}
            </span>
          ) : null}
          {exercise.name}
        </h2>
        <p className="mt-1 font-mono text-xs text-white/45">
          {formatExerciseTargetLine(exercise)}
        </p>
        {exercise.note?.trim() ? (
          <p className="mt-1.5 text-sm text-white/55">{exercise.note}</p>
        ) : null}

        <div className="mt-4 flex items-center gap-2">
          {exercise.sets.map((s, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Seria ${i + 1}${s.done ? ", zaliczona" : ""}`}
              aria-pressed={i === activeSetIndex}
              onClick={() => setManualSetIndex(i)}
              className={cn(
                "h-3 flex-1 rounded-full transition",
                i === activeSetIndex
                  ? "bg-[var(--gym-gold)] ring-2 ring-[var(--gym-gold)]/50 ring-offset-1 ring-offset-black"
                  : s.done
                    ? "bg-[var(--gym-gold)]/70"
                    : "bg-white/15 hover:bg-white/25",
              )}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-white/55">
          <span className="font-semibold uppercase tracking-wide">
            Seria {activeSetIndex + 1} z {exercise.sets.length}
            {set.done ? " · edycja" : ""}
          </span>
          <div className="flex items-center gap-2">
            {onRemoveLastSet && exercise.sets.length > 1 ? (
              <button
                type="button"
                onClick={() => {
                  onRemoveLastSet(exercise.id);
                  setManualSetIndex(null);
                }}
                className="rounded-lg border border-white/12 px-2 py-1 text-[11px] text-white/60 hover:text-white"
              >
                Usuń ostatnią
              </button>
            ) : null}
            {onAddSet ? (
              <button
                type="button"
                onClick={() => {
                  onAddSet(exercise.id);
                  setManualSetIndex(exercise.sets.length);
                }}
                className="rounded-lg border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 px-2 py-1 text-[11px] font-semibold text-[var(--gym-gold)]"
              >
                + Seria
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#161616] p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/45">
            <label htmlFor="set-weight">Ciężar · kg</label>
            <span>wpisz lub ±</span>
          </div>
          {suggestedWeight != null && set.weight <= 0 ? (
            <button
              type="button"
              onClick={() => {
                const next = clampWeight(suggestedWeight);
                setWeightText(String(next));
                onPatchSet(exercise.id, activeSetIndex, {
                  weight: next,
                  done: false,
                });
              }}
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
                const next = clampWeight((parseWeightInput(weightText) ?? set.weight) - 2.5);
                setWeightText(next > 0 ? String(next) : "");
                onPatchSet(exercise.id, activeSetIndex, { weight: next, done: false });
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
                setWeightText(e.target.value);
                const parsed = parseWeightInput(e.target.value);
                if (parsed != null) {
                  onPatchSet(exercise.id, activeSetIndex, {
                    weight: parsed,
                    done: false,
                  });
                }
              }}
              onBlur={() => {
                const parsed = parseWeightInput(weightText);
                const next = parsed ?? 0;
                setWeightText(next > 0 ? String(next) : "");
                onPatchSet(exercise.id, activeSetIndex, {
                  weight: next,
                  done: false,
                });
              }}
              className={inputClass}
            />
            <button
              type="button"
              aria-label="Zwiększ ciężar"
              onClick={() => {
                const next = clampWeight((parseWeightInput(weightText) ?? set.weight) + 2.5);
                setWeightText(String(next));
                onPatchSet(exercise.id, activeSetIndex, { weight: next, done: false });
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
                const next = clampWeight((parseWeightInput(weightText) ?? set.weight) - 0.5);
                setWeightText(next > 0 ? String(next) : "");
                onPatchSet(exercise.id, activeSetIndex, { weight: next, done: false });
              }}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/70"
            >
              − 0,5
            </button>
            <button
              type="button"
              onClick={() => {
                const next = clampWeight((parseWeightInput(weightText) ?? set.weight) + 0.5);
                setWeightText(String(next));
                onPatchSet(exercise.id, activeSetIndex, { weight: next, done: false });
              }}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.03] text-sm text-white/70"
            >
              + 0,5
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#161616] p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/45">
            <label htmlFor="set-reps">Powtórzenia</label>
            <span>wpisz lub ±</span>
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
                setRepsText(next > 0 ? String(next) : "");
                onPatchSet(exercise.id, activeSetIndex, {
                  reps: next > 0 ? next : null,
                  done: false,
                });
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
                setRepsText(e.target.value);
                const parsed = parseRepsInput(e.target.value);
                if (parsed != null) {
                  onPatchSet(exercise.id, activeSetIndex, {
                    reps: parsed > 0 ? parsed : null,
                    done: false,
                  });
                } else if (e.target.value.trim() === "") {
                  onPatchSet(exercise.id, activeSetIndex, {
                    reps: null,
                    done: false,
                  });
                }
              }}
              onBlur={() => {
                const parsed = parseRepsInput(repsText);
                const next = parsed ?? 0;
                setRepsText(next > 0 ? String(next) : "");
                onPatchSet(exercise.id, activeSetIndex, {
                  reps: next > 0 ? next : null,
                  done: false,
                });
              }}
              className={cn(inputClass, "text-[var(--gym-gold-bright)]")}
            />
            <button
              type="button"
              aria-label="Więcej powtórzeń"
              onClick={() => {
                const cur =
                  parseRepsInput(repsText) ??
                  clampReps(set.reps ?? exercise.targetReps ?? 0);
                const next = Math.min(99, cur + 1);
                setRepsText(String(next));
                onPatchSet(exercise.id, activeSetIndex, { reps: next, done: false });
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
              RIR
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
                        done: false,
                      })
                    }
                    className={cn(
                      "h-11 rounded-xl text-sm font-bold tabular-nums transition",
                      active
                        ? "gold-btn"
                        : "border border-white/10 bg-[#161616] text-white/70 hover:border-[var(--gym-gold)]/40",
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
          className="gold-btn mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold"
        >
          <Check className="h-5 w-5" />
          {set.done ? "Zapisz zmiany serii" : "Zalicz serię"}
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
