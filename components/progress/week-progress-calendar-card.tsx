"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { Meter } from "@/components/progress/progress-ui";
import type { ProgressWeekDay, ProgressWeekSummary } from "@/lib/progress-hub";
import { plural } from "@/lib/progress-format";
import { formatHistoryWeekRange } from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";

function daysLeftLabel(n: number): string {
  if (n <= 0) return "Tydzień zamknięty";
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
  const { monday, daysLeft, done, target, days, today } = summary;
  const remaining = Math.max(0, target - done);
  const verdict = daysLeft <= 0
      ? `Tydzień zamknięty: ${done} z ${target} treningów.`
      : done >= target
        ? "Cel tygodnia zrobiony."
        : done <= 1
        ? "Spokojniejszy tydzień. Wracasz z następnym treningiem."
      : done / Math.max(1, target) >= 0.5
          ? `Na dobrej drodze. Jeszcze ${remaining} ${plural(remaining, "trening", "treningi", "treningów")} do celu.`
          : `Do celu brakuje ${remaining} ${plural(remaining, "treningu", "treningów", "treningów")}. Zostało ${daysLeft} dni.`;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-90 [background:linear-gradient(165deg,rgba(var(--neon-rgb),0.16)_0%,rgba(40,28,8,0.35)_38%,transparent_72%)]"
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-[var(--gym-text-secondary)]">
            Ten tydzień · {formatHistoryWeekRange(monday)}
          </p>
        </div>

        <div className="mt-2.5 flex items-end gap-2">
          <AnimatedMetric
            value={done}
            className="text-[2.75rem] leading-none text-white"
          />
          <p className="pb-1 text-[15px] leading-tight text-white/80">
            z {target} {plural(target, "treningu", "treningów", "treningów")}
          </p>
        </div>

        <Meter pct={target > 0 ? (done / target) * 100 : 0} className="mt-3 h-2" />
        <p className="mt-2 text-[15px] leading-5 text-white/90">{verdict}</p>

        <div role="list" aria-label="Dni tygodnia" className="mt-3.5 grid grid-cols-7 gap-1">
          {days.map((d) => (
            <div role="listitem" aria-label={`${d.label}${d.date === today ? ", dziś" : ""}: ${d.strength ? "trening siłowy" : d.cardio ? "cardio" : "brak treningu"}`} key={d.date}>
              <WeekDayCell day={d} isToday={d.date === today} />
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
          <span className="text-[12px] text-[var(--gym-text-secondary)]">{daysLeftLabel(daysLeft)}</span>
          <Link href="/progress?tab=tydzien" className="inline-flex min-h-11 items-center font-semibold text-[13px] text-[var(--gym-gold)]">Szczegóły tygodnia →</Link>
        </div>
      </div>
    </section>
  );
}
