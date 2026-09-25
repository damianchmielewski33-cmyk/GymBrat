"use client";

import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import type { WorkoutSetState } from "@/components/workout/types";
import { formatVolumeKg, setVolume } from "@/lib/workout-session-calculations";
import { cn } from "@/lib/utils";

const inputBox =
  "h-11 min-h-11 w-full min-w-0 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 text-center text-base font-semibold tabular-nums text-white outline-none transition focus-visible:border-[rgba(var(--neon-rgb),0.5)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]";

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

type GymPadSetRowProps = {
  setIndex: number;
  set: WorkoutSetState;
  animationIndex: number;
  onChange: (patch: Partial<WorkoutSetState>) => void;
  previousLabel?: string | null;
  prBadge?: string | null;
};

/**
 * Wiersz serii: powt. × kg = wynik · check · kopiuj.
 */
export function GymPadSetRow({
  setIndex,
  set,
  animationIndex,
  onChange,
  previousLabel,
  prBadge,
}: GymPadSetRowProps) {
  const lineVol = setVolume(set.reps, set.weight);

  function copyLine() {
    const w = Number.isFinite(set.weight) ? set.weight : 0;
    const r = set.reps == null || !Number.isFinite(set.reps) ? "—" : String(set.reps);
    const text = `${r} × ${w} kg = ${formatVolumeKg(lineVol)} kg`;
    void navigator.clipboard?.writeText(text);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: animationIndex * 0.04 }}
      className={cn(
        "grid grid-cols-[72px_16px_minmax(0,1fr)_16px_minmax(0,0.9fr)_40px_40px] items-center gap-1.5 border-b border-white/[0.07] py-3 last:border-b-0",
        "rounded-xl px-1.5",
        set.done && "bg-[var(--gym-gold)]/[0.06]",
      )}
    >
      <div className="grid gap-1">
        <label
          htmlFor={`gympad-set-${setIndex}-reps`}
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45"
        >
          Powt.
        </label>
        <input
          id={`gympad-set-${setIndex}-reps`}
          type="number"
          inputMode="numeric"
          value={set.reps === null ? "" : set.reps}
          onChange={(e) => onChange({ reps: parseOptionalReps(e.target.value) })}
          className={inputBox}
        />
      </div>

      <span className="text-center text-lg font-medium text-white/45">×</span>

      <div className="grid gap-1">
        <label
          htmlFor={`gympad-set-${setIndex}-weight`}
          className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45"
        >
          kg
        </label>
        <input
          id={`gympad-set-${setIndex}-weight`}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.5"
          value={Number.isFinite(set.weight) && set.weight > 0 ? set.weight : ""}
          onChange={(e) => onChange({ weight: parseOptionalWeight(e.target.value) })}
          className={inputBox}
        />
      </div>

      <span className="text-center text-lg text-white/35">=</span>

      <div className="grid gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Suma
        </span>
        <span className="inline-flex h-11 min-h-11 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] px-2 text-center text-sm font-semibold tabular-nums text-white/85">
          {formatVolumeKg(lineVol)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onChange({ done: !set.done })}
        aria-pressed={set.done}
        aria-label={
          set.done
            ? `Seria ${setIndex + 1}: odznacz jako wykonaną`
            : `Seria ${setIndex + 1}: oznacz jako wykonaną`
        }
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full border transition",
          set.done
            ? "border-[var(--gym-gold)] bg-[var(--gym-gold)] text-black"
            : "border-white/20 bg-transparent text-white/35 hover:border-white/40",
        )}
      >
        <Check className="h-5 w-5" strokeWidth={2.5} />
      </button>

      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={copyLine}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.03] text-white/45 hover:text-[var(--gym-gold)]"
        aria-label={`Seria ${setIndex + 1}: kopiuj`}
      >
        <Copy className="h-4 w-4" />
      </motion.button>

      {previousLabel ? (
        <p className="col-span-full text-center text-[10px] text-amber-200/75">
          Ostatnio: {previousLabel}
        </p>
      ) : null}

      {prBadge ? (
        <p className="col-span-full text-center text-[10px] font-semibold text-emerald-300/90">
          {prBadge}
        </p>
      ) : null}
    </motion.div>
  );
}
