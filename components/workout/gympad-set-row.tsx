"use client";

import { motion } from "framer-motion";
import { Copy } from "lucide-react";
import type { WorkoutSetState } from "@/components/workout/types";
import { formatVolumeKg, setVolume } from "@/lib/workout-session-calculations";
import { cn } from "@/lib/utils";

const inputBox =
  "h-11 w-full min-w-0 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 text-center text-base font-semibold tabular-nums text-white outline-none transition focus:border-[var(--neon)]/55 focus:ring-2 focus:ring-[var(--neon)]/20";

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
  /** Ostatnia sesja — ta sama seria (plan id). */
  previousLabel?: string | null;
  /** Rekord / pierwszy zapis — z API postępów. */
  prBadge?: string | null;
};

/**
 * Wiersz serii jak w GymPad: powt. × kg = wynik · kopiuj.
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
        "grid grid-cols-[84px_18px_1fr_18px_1fr_44px] items-center gap-2 border-b border-white/[0.07] py-3 last:border-b-0",
        "rounded-xl px-2",
        set.done && "bg-emerald-500/5",
      )}
    >
      <div className="grid gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Powt.
        </span>
        <input
          type="number"
          inputMode="numeric"
          value={set.reps === null ? "" : set.reps}
          onChange={(e) => onChange({ reps: parseOptionalReps(e.target.value) })}
          className={inputBox}
        />
      </div>

      <span className="text-center text-lg font-medium text-white/45">×</span>

      <div className="grid gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Ciężar
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.5"
            value={Number.isFinite(set.weight) && set.weight > 0 ? set.weight : ""}
            onChange={(e) => onChange({ weight: parseOptionalWeight(e.target.value) })}
            className={inputBox}
          />
          <span className="shrink-0 text-xs font-medium text-white/45">kg</span>
        </div>
      </div>

      <span className="text-center text-lg text-white/35">=</span>

      <div className="grid gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          Wynik
        </span>
        <span className="inline-flex h-11 items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.03] px-3 text-center text-sm font-semibold tabular-nums text-white/85">
          {formatVolumeKg(lineVol)}{" "}
          <span className="ml-1 text-xs font-medium text-white/45">kg</span>
        </span>
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={copyLine}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.10] bg-white/[0.03] text-white/55 transition hover:bg-white/[0.06] hover:text-[var(--neon)]"
        aria-label="Kopiuj serię"
      >
        <Copy className="h-5 w-5" />
      </motion.button>

      {previousLabel ? (
        <p className="col-span-full -mt-1 text-center text-[10px] leading-snug text-amber-200/80">
          Ostatnio: {previousLabel}
        </p>
      ) : null}

      <div className="col-span-full flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          RPE
        </span>
        <select
          value={set.rpe == null ? "" : String(set.rpe)}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ rpe: v === "" ? null : Math.min(10, Math.max(1, Number(v))) });
          }}
          className="h-9 min-w-[4.5rem] rounded-lg border border-white/[0.12] bg-black/40 px-2 text-sm text-white outline-none focus:border-[var(--neon)]/45"
          aria-label={`RPE seria ${setIndex + 1}`}
        >
          <option value="">—</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {prBadge ? (
          <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-100">
            {prBadge}
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
