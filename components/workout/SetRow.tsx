"use client";

import { motion } from "framer-motion";
import { Check, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkoutSetState } from "@/components/workout/types";
import { cn } from "@/lib/utils";

type SetRowProps = {
  setIndex: number;
  set: WorkoutSetState;
  animationIndex: number;
  /** Brak historii z API — jak w GymPad: kolumna „poprzednio” na przyszłość */
  previousLabel?: string;
  onChange: (patch: Partial<WorkoutSetState>) => void;
  onAdjustReps: (delta: number) => void;
  onAdjustWeight: (delta: number) => void;
};

const stepperBtn =
  "flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#0d0d0d] text-white/80 transition active:scale-95 hover:bg-white/[0.06] hover:text-white";

const fieldInput =
  "h-12 w-full min-w-0 rounded-xl border border-white/[0.08] bg-[#0d0d0d] px-2 text-center text-lg font-semibold tabular-nums text-white outline-none transition focus:border-[#3B82F6]/50 focus:ring-2 focus:ring-[#3B82F6]/25";

/**
 * Wiersz serii w stylu dziennika (GymPad / Strong): siatka, duże pola, subtelne linie.
 */
export function SetRow({
  setIndex,
  set,
  animationIndex,
  previousLabel = "—",
  onChange,
  onAdjustReps,
  onAdjustWeight,
}: SetRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: animationIndex * 0.025, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "border-b border-white/[0.06] last:border-b-0",
        set.done && "bg-[#0f1f14]/40",
      )}
    >
      <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-[44px_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_48px] sm:items-center sm:gap-2 sm:py-2">
        {/* Nr serii */}
        <div className="flex items-center justify-between sm:block sm:text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/35 sm:hidden">
            Seria
          </span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-white/80">
            {setIndex + 1}
          </span>
        </div>

        {/* Poprzednio */}
        <div className="flex flex-col justify-center sm:min-h-[3rem]">
          <span className="mb-1 text-[10px] font-medium uppercase tracking-wider text-white/35 sm:hidden">
            Poprzednio
          </span>
          <p className="text-center text-xs tabular-nums text-white/40 sm:text-sm">{previousLabel}</p>
        </div>

        {/* Ciężar */}
        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
            kg
          </span>
          <div className="flex items-center gap-1.5">
            <motion.button type="button" whileTap={{ scale: 0.92 }} className={stepperBtn} onClick={() => onAdjustWeight(-2.5)}>
              <Minus className="h-5 w-5" />
            </motion.button>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={Number.isFinite(set.weight) ? set.weight : 0}
              onChange={(e) => onChange({ weight: Number(e.target.value) })}
              className={fieldInput}
            />
            <motion.button type="button" whileTap={{ scale: 0.92 }} className={stepperBtn} onClick={() => onAdjustWeight(2.5)}>
              <Plus className="h-5 w-5" />
            </motion.button>
          </div>
        </div>

        {/* Powtórzenia */}
        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/35">
            Powtórzenia
          </span>
          <div className="flex items-center gap-1.5">
            <motion.button type="button" whileTap={{ scale: 0.92 }} className={stepperBtn} onClick={() => onAdjustReps(-1)}>
              <Minus className="h-5 w-5" />
            </motion.button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={Number.isFinite(set.reps) ? set.reps : 0}
              onChange={(e) => onChange({ reps: Number(e.target.value) })}
              className={fieldInput}
            />
            <motion.button type="button" whileTap={{ scale: 0.92 }} className={stepperBtn} onClick={() => onAdjustReps(1)}>
              <Plus className="h-5 w-5" />
            </motion.button>
          </div>
        </div>

        {/* Ukończone */}
        <div className="flex justify-end sm:justify-center">
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onChange({ done: !set.done })}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full border-2 transition",
              set.done
                ? "border-[#34D399] bg-[#34D399]/15 text-[#34D399]"
                : "border-white/15 bg-transparent text-white/30 hover:border-white/30 hover:text-white/50",
            )}
            aria-label={set.done ? "Cofnij serię" : "Oznacz serię"}
          >
            <Check className="h-6 w-6" strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
