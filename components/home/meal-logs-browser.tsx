"use client";

import { useMemo, useState } from "react";
import type { MealLogDto } from "@/lib/meal-logs";
import { MealLogsList } from "@/components/home/meal-logs-list";
import { cn } from "@/lib/utils";

function toLabel(dateKey: string) {
  // YYYY-MM-DD -> "DD.MM"
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateKey);
  return m ? `${m[2]}.${m[1]}` : dateKey;
}

export function MealLogsBrowser({
  todayKey,
  availableDateKeys,
  entriesByDate,
}: {
  todayKey: string;
  availableDateKeys: string[];
  entriesByDate: Record<string, MealLogDto[]>;
}) {
  const orderedKeys = useMemo(() => {
    const unique = [...new Set(availableDateKeys)].filter(Boolean);
    unique.sort(); // rosnąco
    return unique;
  }, [availableDateKeys]);

  const [selected, setSelected] = useState(() =>
    orderedKeys.includes(todayKey) ? todayKey : orderedKeys.at(-1) ?? todayKey,
  );

  const entries = entriesByDate[selected] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {orderedKeys.map((k) => {
          const active = k === selected;
          const isToday = k === todayKey;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSelected(k)}
              className={cn(
                "h-9 rounded-xl border px-3 text-xs font-medium transition",
                active
                  ? "border-[var(--neon)]/45 bg-white/[0.07] text-white"
                  : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/18 hover:bg-white/[0.055]",
              )}
            >
              {isToday ? "Dziś" : toLabel(k)}
              <span className="ml-2 font-mono text-[10px] text-white/35">
                {k}
              </span>
            </button>
          );
        })}
      </div>

      <MealLogsList entries={entries} dateKey={selected} embedded />
    </div>
  );
}

