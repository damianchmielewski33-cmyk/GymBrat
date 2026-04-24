"use client";

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
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
  "flex h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#0d0d0d] text-white/80 outline-none transition active:scale-95 hover:bg-white/[0.06] hover:text-white focus-visible:z-10 focus-visible:border-[rgba(255,72,98,0.55)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

const fieldInput =
  "h-12 w-full min-w-0 min-h-12 rounded-xl border border-white/[0.08] bg-[#0d0d0d] px-2 text-center text-lg font-semibold tabular-nums text-white outline-none transition focus-visible:border-[rgba(255,72,98,0.5)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";

function parseOptionalReps(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalWeight(raw: string): number {
  const t = raw.trim();
  if (t === "") return 0;
  const n = Number(t);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

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
      <div className="grid grid-cols-1 gap-3 py-3 sm:grid-cols-[44px_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-2 sm:py-2">
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
          <label
            htmlFor={`set-${setIndex}-weight`}
            className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/50"
          >
            Ciężar (kg)
          </label>
          <div className="flex items-center gap-1.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              className={stepperBtn}
              aria-label={`Seria ${setIndex + 1}: zmniejsz ciężar o 2,5 kg`}
              onClick={() => onAdjustWeight(-2.5)}
            >
              <Minus className="h-5 w-5 shrink-0" aria-hidden />
            </motion.button>
            <input
              id={`set-${setIndex}-weight`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              aria-label={`Seria ${setIndex + 1}: ciężar w kilogramach`}
              value={Number.isFinite(set.weight) && set.weight > 0 ? set.weight : ""}
              onChange={(e) => onChange({ weight: parseOptionalWeight(e.target.value) })}
              className={fieldInput}
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              className={stepperBtn}
              aria-label={`Seria ${setIndex + 1}: zwiększ ciężar o 2,5 kg`}
              onClick={() => onAdjustWeight(2.5)}
            >
              <Plus className="h-5 w-5 shrink-0" aria-hidden />
            </motion.button>
          </div>
        </div>

        {/* Powtórzenia */}
        <div>
          <label
            htmlFor={`set-${setIndex}-reps`}
            className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/50"
          >
            Powtórzenia
          </label>
          <div className="flex items-center gap-1.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              className={stepperBtn}
              aria-label={`Seria ${setIndex + 1}: odejmij jedno powtórzenie`}
              onClick={() => onAdjustReps(-1)}
            >
              <Minus className="h-5 w-5 shrink-0" aria-hidden />
            </motion.button>
            <input
              id={`set-${setIndex}-reps`}
              type="number"
              inputMode="numeric"
              aria-label={`Seria ${setIndex + 1}: liczba powtórzeń`}
              value={set.reps === null ? "" : set.reps}
              onChange={(e) => onChange({ reps: parseOptionalReps(e.target.value) })}
              className={fieldInput}
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              className={stepperBtn}
              aria-label={`Seria ${setIndex + 1}: dodaj jedno powtórzenie`}
              onClick={() => onAdjustReps(1)}
            >
              <Plus className="h-5 w-5 shrink-0" aria-hidden />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
