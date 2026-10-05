"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Footprints } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  minutesCompleted: number;
  weeklyGoal: number;
  /** Wewnątrz karty „Trening na dziś” — bez osobnego app-card. */
  embedded?: boolean;
};

function weeklyCardioPercent(minutesCompleted: number, weeklyGoal: number): number {
  if (weeklyGoal <= 0) return 0;
  return Math.min(100, Math.round((minutesCompleted / weeklyGoal) * 1000) / 10);
}

export function HomeCardioProgressStrip({
  minutesCompleted,
  weeklyGoal,
  embedded = false,
}: Props) {
  const safe = weeklyCardioPercent(minutesCompleted, weeklyGoal);
  const width = Math.min(100, Math.max(0, safe));
  const mins = Math.round(minutesCompleted);

  return (
    <Link
      href="/cardio"
      className={cn(
        "block transition-colors",
        embedded
          ? "rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-2.5 hover:bg-black/35"
          : "app-card-raised px-3.5 py-3 hover:bg-white/[0.02]",
      )}
      aria-label={`Cardio w tygodniu: ${mins} z ${weeklyGoal} minut, ${safe.toFixed(safe >= 100 ? 0 : 1)} procent celu`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/10",
            embedded ? "h-8 w-8" : "h-9 w-9",
          )}
        >
          <Footprints
            className={cn(
              "text-[var(--gym-gold)]",
              embedded ? "h-3.5 w-3.5" : "h-4 w-4",
            )}
            aria-hidden
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Cardio · 7 dni
            </p>
            <p className="shrink-0 font-metric text-[13px] tabular-nums text-white">
              <span className="text-[var(--gym-gold)]">{mins}</span>
              <span className="text-white/35"> / {weeklyGoal} min</span>
            </p>
          </div>
          <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--gym-gold-deep)] via-[var(--gym-gold)] to-[var(--gym-gold-bright)]"
              initial={false}
              animate={{ width: `${width}%` }}
              transition={{ duration: 0.75, ease: "easeOut" }}
            />
          </div>
          {!embedded ? (
            <p className="mt-1.5 text-[11px] text-white/40">
              {width >= 100
                ? "Cel tygodniowy zaliczony"
                : `${safe.toFixed(safe >= 100 ? 0 : 1)}% zalecenia · kliknij, by dodać wpis`}
            </p>
          ) : null}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/25" aria-hidden />
      </div>
    </Link>
  );
}
