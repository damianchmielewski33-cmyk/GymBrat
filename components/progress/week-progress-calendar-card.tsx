"use client";

import { Check } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { StatTile } from "@/components/progress/progress-ui";
import type { ProgressWeekDay, ProgressWeekSummary } from "@/lib/progress-hub";
import { fmtNum, plural } from "@/lib/progress-format";
import { formatHistoryWeekRange, formatTonnes } from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";

function daysLeftLabel(n: number): string {
  if (n <= 0) return "tydzień się kończy";
  if (n === 1) return "został 1 dzień";
  return `zostało ${n} dni`;
}

function WeekDayCell({
  day,
  isToday,
}: {
  day: ProgressWeekDay;
  isToday: boolean;
}) {
  const active = day.strength || isToday;

  return (
    <div className="flex min-w-0 flex-col items-center">
      <span
        className={cn(
          "mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
          active ? "text-white/80" : "text-white/35",
        )}
      >
        {day.label}
      </span>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2",
          day.strength
            ? "border-[var(--gym-gold)] bg-[var(--gym-gold)] text-black shadow-[0_0_14px_rgba(var(--neon-rgb),0.32)]"
            : isToday
              ? "border-[var(--gym-gold)] bg-transparent"
              : "border-white/14 bg-white/[0.04]",
        )}
        aria-hidden={!day.strength && !isToday}
      >
        {day.strength ? (
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
        ) : null}
      </div>
      <span
        className={cn(
          "mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full",
          day.cardio ? "bg-sky-400" : "opacity-0",
        )}
        aria-hidden={!day.cardio}
        title={day.cardio ? "Cardio" : undefined}
      />
    </div>
  );
}

/**
 * Jedna karta „ten tydzień”: kalendarz treningów + tonaż, cardio i seria.
 * Zastępuje dawne dwie osobne sekcje (kalendarz oraz „W tym tygodniu”).
 */
export function WeekProgressCalendarCard({
  summary,
}: {
  summary: ProgressWeekSummary;
}) {
  const {
    monday,
    daysLeft,
    done,
    target,
    days,
    today,
    tonnageKg,
    prevWeekTonnageKg,
    cardioMinutes,
    cardioGoalMinutes,
    streakWeeks,
  } = summary;

  return (
    <section className="app-card relative overflow-hidden px-3.5 py-3.5">
      <div
        className="pointer-events-none absolute inset-0 opacity-90 [background:linear-gradient(165deg,rgba(var(--neon-rgb),0.16)_0%,rgba(40,28,8,0.35)_38%,transparent_72%)]"
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[10px] font-semibold uppercase leading-snug tracking-[0.12em] text-[var(--gym-gold)]">
            {formatHistoryWeekRange(monday)}
          </p>
          <p className="shrink-0 text-[11px] tabular-nums text-white/45">
            {daysLeftLabel(daysLeft)}
          </p>
        </div>

        <div className="mt-2.5 flex items-end gap-2">
          <AnimatedMetric
            value={done}
            className="text-[2.25rem] leading-none text-white"
          />
          <p className="pb-0.5 text-[13px] leading-tight text-white/55">
            z {target} {plural(target, "treningu", "treningów", "treningów")}
          </p>
        </div>

        <div className="mt-3.5 grid grid-cols-7 gap-0.5 sm:gap-1">
          {days.map((d) => (
            <WeekDayCell key={d.date} day={d} isToday={d.date === today} />
          ))}
        </div>

        <p className="mt-2 flex items-center justify-center gap-3 text-[10px] text-white/40">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--gym-gold)]" aria-hidden />
            trening
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" aria-hidden />
            cardio
          </span>
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
          <StatTile
            label="Tonaż"
            value={
              <>
                {fmtNum(Math.max(0, tonnageKg) / 1000, 1)}
                <span className="ml-0.5 text-[11px] text-white/40">t</span>
              </>
            }
            hint={`poprz. ${formatTonnes(prevWeekTonnageKg)}`}
          />
          <StatTile
            label="Cardio"
            value={
              <>
                {fmtNum(cardioMinutes)}
                <span className="ml-0.5 text-[11px] text-white/40">min</span>
              </>
            }
            hint={`cel ${cardioGoalMinutes} min`}
          />
          <StatTile
            label="Seria"
            value={
              <>
                {streakWeeks}
                <span className="ml-0.5 text-[11px] text-white/40">tyg.</span>
              </>
            }
            hint="z treningiem"
          />
        </div>
      </div>
    </section>
  );
}
