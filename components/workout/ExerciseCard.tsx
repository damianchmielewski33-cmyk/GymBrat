"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { SetRow } from "@/components/workout/SetRow";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";
import { exerciseVolume, formatVolumeKg } from "@/lib/workout-session-calculations";
import { cn } from "@/lib/utils";

/** Blok ćwiczenia jak w GymPad: karta + tabela serii bez zbędnych efektów. */
const cardShell =
  "overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1a1a1a] shadow-[0_2px_12px_rgba(0,0,0,0.35)]";

function clampIntLocal(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampWeightLocal(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(999, Math.round(n * 2) / 2));
}

type ExerciseCardProps = {
  exercise: WorkoutExerciseState;
  exerciseIndex: number;
  onPatchSet: (setIndex: number, patch: Partial<WorkoutSetState>) => void;
  onAdjustReps: (setIndex: number, delta: number) => void;
  onAdjustWeight: (setIndex: number, delta: number) => void;
  onAddSet: () => void;
};

export function ExerciseCard({
  exercise,
  exerciseIndex,
  onPatchSet,
  onAdjustReps,
  onAdjustWeight,
  onAddSet,
}: ExerciseCardProps) {
  const exTotal = exerciseVolume(exercise.sets);

  function applyPatch(setIdx: number, patch: Partial<WorkoutSetState>) {
    const next: Partial<WorkoutSetState> = { ...patch };
    if (patch.reps !== undefined) {
      next.reps =
        patch.reps === null ? null : clampIntLocal(patch.reps, 0, 999);
    }
    if (patch.weight !== undefined) next.weight = clampWeightLocal(patch.weight);
    onPatchSet(setIdx, next);
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: exerciseIndex * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={cn(cardShell)}
    >
      <div className="border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
        <h3 className="text-[17px] font-semibold leading-snug tracking-tight text-white">
          {exercise.name}
        </h3>
        <p className="mt-0.5 text-[12px] text-white/40">
          {exercise.sets.length} {exercise.sets.length === 1 ? "seria" : "serii"}
        </p>
      </div>

      {/* Nagłówki tabeli — ukryte na mobile (SetRow ma własne etykiety) */}
      <div className="hidden border-b border-white/[0.06] bg-[#151515] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/35 sm:grid sm:grid-cols-[44px_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_48px] sm:gap-2 sm:px-5">
        <span className="text-center">#</span>
        <span className="text-center">Poprzednio</span>
        <span className="text-center">kg</span>
        <span className="text-center">Powt.</span>
        <span className="text-center">✓</span>
      </div>

      <div className="px-2 sm:px-4">
        {exercise.sets.map((set, setIdx) => (
          <SetRow
            key={`${exercise.id}-set-${setIdx}`}
            setIndex={setIdx}
            set={set}
            animationIndex={setIdx + exerciseIndex * 4}
            onChange={(patch) => applyPatch(setIdx, patch)}
            onAdjustReps={(delta) => onAdjustReps(setIdx, delta)}
            onAdjustWeight={(delta) => onAdjustWeight(setIdx, delta)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-white/[0.06] bg-[#151515] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Objętość ćwiczenia
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">
            {formatVolumeKg(exTotal)} <span className="text-sm font-normal text-white/45">kg</span>
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAddSet}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-[#222] px-4 py-2.5 text-sm font-medium text-white/90 transition hover:bg-[#2a2a2a]"
        >
          <Plus className="h-4 w-4" />
          Dodaj serię
        </motion.button>
      </div>
    </motion.section>
  );
}
