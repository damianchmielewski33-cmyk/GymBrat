"use client";

import { Loader2, RotateCcw, X } from "lucide-react";
import { SessionExerciseListStatic } from "@/components/home/home-workout-board";
import type { WorkoutExerciseState } from "@/components/workout/types";

export function SessionExerciseListSheet({
  title,
  exercises,
  currentId,
  saving,
  saveError,
  onClose,
  onPick,
  onReset,
  onComplete,
}: {
  title: string;
  exercises: WorkoutExerciseState[];
  currentId: string | null;
  saving: boolean;
  saveError?: string | null;
  onClose: () => void;
  onPick: (id: string) => void;
  onReset: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
            Lista ćwiczeń
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70"
          aria-label="Zamknij listę"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        <SessionExerciseListStatic
          currentId={currentId}
          onPick={onPick}
          exercises={exercises.map((ex) => ({
            id: ex.id,
            name: ex.name,
            setCount: ex.sets.length,
            targetReps: ex.targetReps ?? ex.sets[0]?.reps ?? 10,
            doneCount: ex.sets.filter((s) => s.done).length,
          }))}
        />
      </div>
      {saveError ? <p className="mt-3 text-sm text-red-400">{saveError}</p> : null}
      <div className="mt-4 grid gap-2">
        <button
          type="button"
          onClick={onComplete}
          disabled={saving}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-b from-[#e8c547] to-[#c4a028] text-sm font-semibold text-[#1a1408] disabled:opacity-40"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Zakończ trening
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 text-sm text-white/70"
        >
          <RotateCcw className="h-4 w-4" />
          Resetuj sesję
        </button>
      </div>
    </div>
  );
}
