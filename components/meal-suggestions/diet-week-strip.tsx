"use client";

import { addCalendarDays, calendarDateKey, calendarWeekdaySun0 } from "@/lib/local-date";
import { cn } from "@/lib/utils";

const DAY_LETTERS = ["N", "P", "W", "Ś", "C", "P", "S"] as const;

function weekMondayKeys(anchor: string): string[] {
  const dow = calendarWeekdaySun0(anchor);
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addCalendarDays(anchor, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addCalendarDays(monday, i));
}

export function DietWeekStrip({
  dateKey,
  onSelect,
}: {
  dateKey: string;
  onSelect: (key: string) => void;
}) {
  const today = calendarDateKey();
  const keys = weekMondayKeys(dateKey);

  return (
    <div
      className="flex items-end justify-between gap-1 px-1"
      role="tablist"
      aria-label="Dni tygodnia"
    >
      {keys.map((key) => {
        const dayNum = Number(key.slice(8, 10));
        const letter = DAY_LETTERS[calendarWeekdaySun0(key)] ?? "?";
        const active = key === dateKey;
        const isPastOrToday = key <= today;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(key)}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "text-[11px] font-medium uppercase",
                active ? "text-white" : "text-white/40",
              )}
            >
              {letter}
            </span>
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-all duration-300 ease-out",
                active
                  ? "scale-105 bg-[var(--gym-gold)] text-black shadow-[0_4px_14px_rgba(212,175,55,0.35)]"
                  : "scale-100 bg-transparent text-white/75",
              )}
            >
              {dayNum}
            </span>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors duration-300",
                isPastOrToday && !active ? "bg-[var(--gym-gold)]/70" : "bg-transparent",
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
