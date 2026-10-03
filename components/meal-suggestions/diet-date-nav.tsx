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
  const title = isToday ? "Dziś" : long;

  return (
    <div className="flex items-center justify-center gap-3 px-1">
      <button
        type="button"
        aria-label="Poprzedni dzień"
        onClick={() => onSelect(addCalendarDays(dateKey, -1))}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.06] hover:text-white"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 text-center">
        <p className="text-[15px] font-semibold text-white">{title}</p>
        {isToday ? (
          <p className="mt-0.5 text-[12px] capitalize text-white/45">{long}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Następny dzień"
        onClick={() => onSelect(addCalendarDays(dateKey, 1))}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/55 hover:bg-white/[0.06] hover:text-white"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
