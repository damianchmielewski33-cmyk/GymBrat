"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CardioLogSheet } from "@/components/treningi/cardio-log-sheet";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import type { ExtraCardioAdvice } from "@/lib/extra-cardio-from-macros";

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

/** „Ten tydzień”: pierścień cardio, treningi, seria tygodni i wyjaśnienie dodatkowego cardio. */
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
    cardioGoalMinutes > 0 ? Math.min(1, mins / cardioGoalMinutes) : 0;
  const reached = cardioGoalMinutes > 0 && mins >= cardioGoalMinutes;
  const overBy = reached ? mins - cardioGoalMinutes : 0;
  const extra =
    extraCardio?.show && extraCardio.extraMinutes > 0
      ? extraCardio.extraMinutes
      : 0;
  const extraCovered = extra > 0 && overBy >= extra;

  return (
    <section className="app-card p-4" aria-labelledby="home-week-h">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="home-week-h"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]"
        >
          Ten tydzień
        </h2>
        {reached ? (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
            Cel cardio osiągnięty
          </span>
        ) : null}
      </div>

      <div className="mt-2.5 grid grid-cols-[132px_1fr] items-stretch gap-3">
        <div
          className="relative flex items-center justify-center rounded-2xl border border-[var(--gym-gold)]/20 bg-black/30 py-2.5"
          role="progressbar"
          aria-label="Cardio w tym tygodniu"
          aria-valuemin={0}
          aria-valuemax={cardioGoalMinutes}
          aria-valuenow={Math.min(mins, cardioGoalMinutes)}
        >
          <svg
            width="104"
            height="104"
            viewBox="0 0 104 104"
            aria-hidden
            style={{ filter: "drop-shadow(0 0 8px rgba(246,227,161,0.35))" }}
          >
            <defs>
              <linearGradient id="home-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#f6e3a1" />
                <stop offset="1" stopColor="#b8903f" />
              </linearGradient>
            </defs>
            <circle cx="52" cy="52" r={RING_R} fill="none" stroke="var(--gym-track)" strokeWidth="9" />
            <circle
              cx="52"
              cy="52"
              r={RING_R}
              fill="none"
              stroke="url(#home-ring)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - pct)}
              transform="rotate(-90 52 52)"
              className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatedMetric value={mins} className="text-[36px] leading-none text-white" />
            <span className="mt-0.5 text-[10px] text-white/60">
              / {cardioGoalMinutes} min cardio
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Tile label="Treningi">
            <AnimatedMetric value={workoutsThisWeek} className="text-[32px] leading-none text-white" />
          </Tile>
          <Tile label="Tygodni z rzędu">
            <AnimatedMetric value={workoutStreakWeeks} className="text-[32px] leading-none text-[var(--gym-gold-bright)]" />
          </Tile>
        </div>
      </div>

      {extra > 0 ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-br from-[rgba(var(--neon-rgb),0.16)] to-black/30 px-3 py-2.5">
          <div className="shrink-0 border-r border-[var(--gym-gold)]/25 pr-3 text-center">
            <p className="font-display text-[34px] leading-none text-[var(--gym-gold-bright)]">
              {extra}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-white/60">min extra</p>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-white">
              Dodatkowe cardio z nadwyżki makro
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-white/65">
              Zjadłeś więcej niż w planie, więc tyle cardio ją zbilansuje.
              {extraCovered ? (
                <>
                  {" "}Masz już {overBy} min ponad tygodniowy cel,{" "}
                  <b className="text-emerald-300">nadwyżka jest pokryta</b>.
                </>
              ) : reached ? null : (
                <>{" "}Do celu tygodnia zostało {Math.max(0, cardioGoalMinutes - mins)} min.</>
              )}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[12px] leading-snug text-white/65">
          {reached
            ? `Cel cardio przekroczony o ${overBy} min.`
            : `Do celu cardio zostało ${Math.max(0, cardioGoalMinutes - mins)} min.`}
        </p>
      )}

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="gold-btn mt-2.5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[13px]"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Dodaj cardio
      </button>

      <CardioLogSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        weekProgress={cardioSheetWeek}
      />
    </section>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-between rounded-2xl border border-white/[0.07] bg-black/30 px-3 py-2">
      <p className="text-[11px] font-semibold text-white/60">{label}</p>
      {children}
    </div>
  );
}
