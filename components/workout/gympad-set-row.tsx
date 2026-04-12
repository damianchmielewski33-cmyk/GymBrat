"use client";

import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import type { WorkoutSetState } from "@/components/workout/types";
import { formatVolumeKg, setVolume } from "@/lib/workout-session-calculations";
import { cn } from "@/lib/utils";

const inputBox =
  "rounded-xl border border-white/10 bg-[#1a1a1a] px-3 py-2.5 text-center text-lg font-bold tabular-nums text-white outline-none focus:border-[#FF9500]/60 focus:ring-1 focus:ring-[#FF9500]/40";

type GymPadSetRowProps = {
  setIndex: number;
  set: WorkoutSetState;
  animationIndex: number;
  onChange: (patch: Partial<WorkoutSetState>) => void;
};

/**
 * Wiersz serii jak w GymPad: powt. × kg = wynik · kopiuj.
 */
export function GymPadSetRow({ setIndex: _setIndex, set, animationIndex, onChange }: GymPadSetRowProps) {
  const lineVol = setVolume(set.reps, set.weight);

  function copyLine() {
    const w = Number.isFinite(set.weight) ? set.weight : 0;
    const r = Number.isFinite(set.reps) ? set.reps : 0;
    const text = `${r} × ${w} kg = ${formatVolumeKg(lineVol)} kg`;
    void navigator.clipboard?.writeText(text);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: animationIndex * 0.04 }}
      className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] py-3 last:border-b-0"
    >
      <button
        type="button"
        onClick={() => onChange({ done: !set.done })}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition",
          set.done
            ? "border-[#84cc16] bg-[#84cc16]/15 text-[#84cc16]"
            : "border-white/20 text-white/35 hover:border-white/35",
        )}
        aria-label={set.done ? "Cofnij" : "Oznacz"}
      >
        <Check className="h-5 w-5" strokeWidth={2.5} />
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={Number.isFinite(set.reps) ? set.reps : 0}
        onChange={(e) => onChange({ reps: Number(e.target.value) })}
        className={cn(inputBox, "w-[4.5rem]")}
      />
      <span className="text-lg font-medium text-white/50">×</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.5"
          value={Number.isFinite(set.weight) ? set.weight : 0}
          onChange={(e) => onChange({ weight: Number(e.target.value) })}
          className={cn(inputBox, "min-w-[5rem]")}
        />
        <span className="text-xs text-white/45">kg</span>
      </div>
      <span className="text-lg text-white/40">=</span>
      <span className="min-w-[5rem] border-b border-white/50 pb-0.5 text-center text-sm font-semibold tabular-nums text-[#bef264]">
        {formatVolumeKg(lineVol)} kg
      </span>
      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={copyLine}
        className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl text-white/50 hover:bg-white/5 hover:text-[#FF9500]"
        aria-label="Kopiuj serię"
      >
        <Copy className="h-5 w-5" />
      </motion.button>
    </motion.div>
  );
}
