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
  children,
}: {
  week: WeekGroup;
  children: ReactNode;
}) {
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
        <p
          className="shrink-0 text-[12px] tabular-nums text-[var(--gym-text-secondary)]"
          aria-hidden
        >
          {count} tr. · {formatTonnes(week.volumeKg)}
        </p>
      </div>
      <div className="app-panel divide-y divide-white/[0.06] overflow-hidden">
        {children}
      </div>
    </section>
  );
}
