"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";

function formatLongDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function DietDateNav({
  dateKey,
  onSelect,
}: {
  dateKey: string;
  onSelect: (key: string) => void;
}) {
  const today = calendarDateKey();
  const isToday = dateKey === today;
  const long = formatLongDate(dateKey);

  const btn =
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white active:bg-white/[0.1]";
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-1">
      <button
        type="button"
        aria-label="Poprzedni dzień"
        onClick={() => onSelect(addCalendarDays(dateKey, -1))}
        className={btn}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 text-center" aria-live="polite">
        <p className="truncate text-[14px] font-semibold capitalize tracking-tight text-white">
          {isToday ? `Dziś · ${long}` : long}
        </p>
        {!isToday ? (
          <button
            type="button"
            onClick={() => onSelect(today)}
            className="text-[11px] font-semibold text-[var(--gym-gold)]"
          >
            Wróć do dziś
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Następny dzień"
        onClick={() => onSelect(addCalendarDays(dateKey, 1))}
        className={btn}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
