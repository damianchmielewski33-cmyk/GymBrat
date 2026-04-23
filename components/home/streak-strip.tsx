"use client";

import { cn } from "@/lib/utils";
import type { StreakStripDay, Streaks } from "@/lib/streaks";

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 rounded-full border",
        on
          ? "border-[var(--neon)]/40 bg-[var(--neon)]/70 shadow-[0_0_14px_rgba(230,0,35,0.25)]"
          : "border-white/12 bg-white/5",
      )}
      aria-hidden
    />
  );
}

function DayPill({ day }: { day: StreakStripDay }) {
  const label = day.dateKey.slice(5);
  return (
    <div className="flex min-w-[3.75rem] flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2">
      <span className="font-mono text-[11px] text-white/55">{label}</span>
      <div className="grid grid-cols-2 gap-1">
        <Dot on={day.checkIn} />
        <Dot on={day.mealLogged} />
        <Dot on={day.workout} />
        <Dot on={day.weighIn} />
      </div>
    </div>
  );
}

export function StreakStrip({ data }: { data: Streaks }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
            Ostatnie 7 dni
          </p>
          <p className="mt-1 text-xs text-white/55">
            Check-in / posiłek / trening / ważenie
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-white/60">
          <span>
            Check-in:{" "}
            <span className="font-mono text-white/85">{data.streak.checkInDays}</span>
          </span>
          <span>
            Posiłki:{" "}
            <span className="font-mono text-white/85">{data.streak.mealLoggedDays}</span>
          </span>
          <span>
            Trening:{" "}
            <span className="font-mono text-white/85">{data.streak.workoutDays}</span>
          </span>
          <span>
            Waga:{" "}
            <span className="font-mono text-white/85">{data.streak.weighInDays}</span>
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {data.days.map((d) => (
          <DayPill key={d.dateKey} day={d} />
        ))}
      </div>
    </div>
  );
}

