"use client";

import type { ReactNode } from "react";
import type { WorkoutHistoryCard } from "@/lib/workout-history-overview";
import {
  formatHistoryWeekRange,
  formatHistoryWeekRelativeTag,
  formatTonnes,
} from "@/lib/workout-history-overview";
import { calendarWeekMondayKey } from "@/lib/local-date";
import { cn } from "@/lib/utils";

export type WeekGroup = {
  monday: string;
  cards: WorkoutHistoryCard[];
  volumeKg: number;
};

export function groupByWeek(cards: WorkoutHistoryCard[]): WeekGroup[] {
  const map = new Map<string, WorkoutHistoryCard[]>();
  for (const c of cards) {
    const m = calendarWeekMondayKey(c.date);
    const list = map.get(m);
    if (list) list.push(c);
    else map.set(m, [c]);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monday, weekCards]) => ({
      monday,
      cards: weekCards,
      volumeKg: weekCards.reduce((s, c) => s + c.volumeKg, 0),
    }));
}

export function WorkoutHistoryWeekGroup({
  week,
  maxVolumeKg = 0,
  children,
}: {
  week: WeekGroup;
  /** Największy tonaż tygodnia na liście — skala paska. */
  maxVolumeKg?: number;
  children: ReactNode;
}) {
  const barPct =
    maxVolumeKg > 0
      ? Math.max(4, Math.round((week.volumeKg / maxVolumeKg) * 100))
      : 0;
  const tag = formatHistoryWeekRelativeTag(week.monday);
  const range = formatHistoryWeekRange(week.monday);
  const count = week.cards.length;
  const ariaAgg = `${count} ${
    count === 1 ? "trening" : count >= 2 && count <= 4 ? "treningi" : "treningów"
  }, ${formatTonnes(week.volumeKg)}`;

  return (
    <section className="mt-6 first:mt-4" aria-label={`${range}. ${ariaAgg}`}>
      <div className="mb-2.5 flex items-end justify-between gap-2 px-0.5">
        <div className="min-w-0">
          {tag ? (
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.14em]",
                tag === "TEN TYDZIEŃ"
                  ? "text-[var(--gym-gold)]"
                  : "text-[var(--gym-text-secondary)]",
              )}
            >
              {tag}
            </p>
          ) : null}
          <h2 className="mt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-white">
            {range}
          </h2>
        </div>
        <div className="w-28 shrink-0 text-right" aria-hidden>
          <p className="text-[12px] font-semibold tabular-nums text-[var(--gym-text-secondary)]">
            {count} tr. · {formatTonnes(week.volumeKg)}
          </p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--gym-track)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--gym-gold-deep)] to-[#f6e3a1] transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${barPct}%` }}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
