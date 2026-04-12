"use client";

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { GymPadSetRow } from "@/components/workout/gympad-set-row";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import {
  exerciseTotalReps,
  exerciseVolume,
  formatVolumeKg,
} from "@/lib/workout-session-calculations";
import { cn } from "@/lib/utils";

function formatHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampWeight(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(999, Math.round(n * 2) / 2));
}

type GymPadSessionLayoutProps = {
  title: string;
  elapsedSeconds: number;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  onPatchSet: (exerciseId: string, setIndex: number, patch: Partial<WorkoutSetState>) => void;
  onAddSet: (exerciseId: string) => void;
  onRemoveLastSet: (exerciseId: string) => void;
};

/**
 * Główny obszar treningu w stylu GymPad: nagłówek, zakładki ćwiczeń, karty statystyk, lista serii.
 */
export function GymPadSessionLayout({
  title,
  elapsedSeconds,
  exercises,
  selectedExerciseId,
  onSelectExercise,
  onPatchSet,
  onAddSet,
  onRemoveLastSet,
}: GymPadSessionLayoutProps) {
  const current = useMemo(
    () => exercises.find((e) => e.id === selectedExerciseId) ?? exercises[0] ?? null,
    [exercises, selectedExerciseId],
  );

  useEffect(() => {
    if (exercises.length === 0) return;
    const ids = new Set(exercises.map((e) => e.id));
    if (!selectedExerciseId || !ids.has(selectedExerciseId)) {
      onSelectExercise(exercises[0]!.id);
    }
  }, [exercises, selectedExerciseId, onSelectExercise]);

  const totalReps = current ? exerciseTotalReps(current.sets) : 0;
  const vol = current ? exerciseVolume(current.sets) : 0;
  const nSets = current?.sets.length ?? 0;

  function applyPatch(setIdx: number, patch: Partial<WorkoutSetState>) {
    if (!current) return;
    const next = { ...patch };
    if (patch.reps !== undefined) next.reps = clampInt(patch.reps, 0, 999);
    if (patch.weight !== undefined) next.weight = clampWeight(patch.weight);
    onPatchSet(current.id, setIdx, next);
  }

  return (
    <div className="bg-black text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <h2 className="min-w-0 flex-1 text-xl font-bold leading-tight tracking-tight text-white">
          {title.trim() || "Trening"}
        </h2>
        <span className="shrink-0 font-mono text-2xl font-semibold tabular-nums text-[#FF9500] sm:text-3xl">
          {formatHMS(elapsedSeconds)}
        </span>
      </div>

      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-white/10 pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {exercises.map((ex) => {
          const active = ex.id === current?.id;
          return (
            <button
              key={ex.id}
              type="button"
              onClick={() => onSelectExercise(ex.id)}
              className={cn(
                "relative shrink-0 whitespace-nowrap px-3 py-2.5 text-left text-sm font-medium transition",
                active
                  ? "text-[#FF9500]"
                  : "text-white/45 hover:text-white/70",
              )}
            >
              {active ? (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#FF9500]" />
              ) : null}
              <span className="line-clamp-2 max-w-[200px]">{ex.name}</span>
            </button>
          );
        })}
      </div>

      {current ? (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="pt-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#84cc16]/35 bg-[#14220a]/80 px-3 py-4 text-center">
              <p className="text-3xl font-bold tabular-nums text-[#bef264]">{totalReps}</p>
              <p className="mt-1 text-xs font-medium text-[#84cc16]/90">powt.</p>
            </div>
            <div className="rounded-2xl border border-[#84cc16]/35 bg-[#14220a]/80 px-3 py-4 text-center">
              <p className="text-2xl font-bold tabular-nums leading-tight text-[#bef264] sm:text-3xl">
                {formatVolumeKg(vol).replace(/\s/g, " ")}
              </p>
              <p className="mt-1 text-xs font-medium text-[#84cc16]/90">ciężar (kg)</p>
            </div>
          </div>

          <p className="mt-4 text-center text-[13px] text-white/65">
            <span className="text-white/90">Powt.:</span> {totalReps}
            <span className="mx-2 text-white/30">·</span>
            <span className="text-white/90">Ciężar:</span> {formatVolumeKg(vol)} kg
            <span className="mx-2 text-white/30">·</span>
            <span className="text-white/90">Serie:</span> {nSets}
          </p>

          <div className="mt-2">
            {current.sets.map((set, idx) => (
              <GymPadSetRow
                key={`${current.id}-${idx}`}
                setIndex={idx}
                set={set}
                animationIndex={idx}
                onChange={(patch) => applyPatch(idx, patch)}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onAddSet(current.id)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FF9500] px-5 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(255,149,0,0.25)]"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
              Dodaj serię
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={current.sets.length <= 1}
              onClick={() => onRemoveLastSet(current.id)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 disabled:opacity-35"
            >
              <Minus className="h-5 w-5" />
              Usuń
            </motion.button>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}
