"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CardioLogSheet } from "@/components/treningi/cardio-log-sheet";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import type { ExtraCardioAdvice } from "@/lib/extra-cardio-from-macros";

/** „Ten tydzień”: treningi, seria tygodni i cardio w jednej karcie. */
export function HomeWeekCard({
  workoutsThisWeek,
  workoutStreakWeeks,
  cardioMinutes,
  cardioGoalMinutes,
  cardioSheetWeek,
  extraCardio = null,
}: {
  workoutsThisWeek: number;
  workoutStreakWeeks: number;
  cardioMinutes: number;
  cardioGoalMinutes: number;
  cardioSheetWeek: { minutesCompleted: number; goalMinutes: number; weekLabel: string };
  extraCardio?: ExtraCardioAdvice | null;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const mins = Math.round(cardioMinutes);
  const pct =
    cardioGoalMinutes > 0 ? Math.min(100, (mins / cardioGoalMinutes) * 100) : 0;
  const over = cardioGoalMinutes > 0 && mins > cardioGoalMinutes;
  const extra =
    extraCardio?.show && extraCardio.extraMinutes > 0
      ? extraCardio.extraMinutes
      : 0;

  return (
    <section className="app-card p-5" aria-labelledby="home-week-h">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="home-week-h"
          className="text-[13px] font-semibold text-white/60"
        >
          Ten tydzień
        </h2>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Dodaj cardio"
          className="gym-tap inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gym-gold)]/45 bg-[rgba(var(--neon-rgb),0.12)] text-[var(--gym-gold)]"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2.5">
        <Stat label="treningi">
          <AnimatedMetric value={workoutsThisWeek} className="text-[44px] leading-none text-white" />
        </Stat>
        <Stat label="tygodni z rzędu">
          <AnimatedMetric value={workoutStreakWeeks} className="text-[44px] leading-none text-white" />
        </Stat>
        <Stat label="min cardio">
          <span className="leading-none">
            <AnimatedMetric value={mins} className="text-[44px] leading-none text-white" />
            <span className="text-[18px] text-white/55">/{cardioGoalMinutes}</span>
          </span>
        </Stat>
      </div>

      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-label="Cardio w tym tygodniu"
        aria-valuemin={0}
        aria-valuemax={cardioGoalMinutes}
        aria-valuenow={Math.min(mins, cardioGoalMinutes)}
      >
        <div
          className={
            "gym-meter-gold h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none " +
            (over ? "!bg-orange-400" : "")
          }
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-[13px] leading-snug text-white/60">
        {over
          ? `Cel cardio przekroczony o ${mins - cardioGoalMinutes} min.`
          : `Do celu cardio zostało ${Math.max(0, cardioGoalMinutes - mins)} min.`}
        {extra > 0 ? ` Dodatkowe ${extra} min z nadwyżki makro.` : ""}
      </p>

      <CardioLogSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        weekProgress={cardioSheetWeek}
      />
    </section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      {children}
      <p className="mt-1 text-[13px] leading-tight text-white/60">{label}</p>
    </div>
  );
}
