"use client";

import { Dumbbell, HeartPulse } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { Meter } from "@/components/progress/progress-ui";
import type { ProgressWeekDay, ProgressWeekSummary } from "@/lib/progress-hub";
import { plural } from "@/lib/progress-format";
import { formatHistoryWeekRange } from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";

function daysLeftLabel(n: number): string {
  if (n <= 0) return "Tydzień zamknięty";
  if (n === 1) return "Został 1 dzień";
  return `Zostało ${n} dni`;
}

function WeekDayCell({
  day,
  isToday,
}: {
  day: ProgressWeekDay;
  isToday: boolean;
}) {
  const label = `${day.label}${isToday ? ", dziś" : ""}: ${
    day.strength && day.cardio
      ? "trening siłowy i cardio"
      : day.strength
        ? "trening siłowy"
        : day.cardio
          ? "cardio"
          : "brak treningu"
  }`;

  return (
    <div
      className={cn(
        "flex h-14 flex-col items-center justify-center gap-1 rounded-xl border bg-black/25 text-[11px] uppercase tracking-wide text-[var(--gym-text-secondary)]",
        isToday
          ? "border-[var(--gym-gold)]/60"
          : "border-white/10",
        !day.strength && !day.cardio && !isToday && "opacity-70",
      )}
      aria-label={label}
      role="listitem"
    >
      <span>{day.label}</span>
      {day.strength && day.cardio ? (
        <span className="flex items-center gap-0.5 text-[var(--gym-gold)]" aria-hidden>
          <Dumbbell className="h-3.5 w-3.5" />
          <HeartPulse className="h-3.5 w-3.5" />
        </span>
      ) : day.strength ? (
        <Dumbbell className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
      ) : day.cardio ? (
        <HeartPulse className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
      ) : (
        <span className="text-base leading-none text-[var(--gym-text-secondary)]" aria-hidden>
          –
        </span>
      )}
    </div>
  );
}

/**
 * Hero „Ten tydzień” — makieta UX 009: liczba, meter, werdykt, DayStrip, stopka.
 */
export function WeekProgressCalendarCard({
  summary,
  onOpenWeek,
  emptyFirstUse,
}: {
  summary: ProgressWeekSummary;
  onOpenWeek?: () => void;
  /** Pierwsze użycie: brak historii treningów w ogóle. */
  emptyFirstUse?: boolean;
}) {
  const { monday, daysLeft, done, target, days, today } = summary;
  const remaining = Math.max(0, target - done);
  const verdict =
    daysLeft <= 0
      ? `Tydzień zamknięty: ${done} z ${target} treningów.`
      : done >= target
        ? "Cel tygodnia zrobiony."
        : done <= 1
          ? "Spokojniejszy tydzień. Wracasz z następnym treningiem."
          : done / Math.max(1, target) >= 0.5
            ? `Na dobrej drodze. Jeszcze ${remaining} ${plural(remaining, "trening", "treningi", "treningów")} do celu.`
            : `Do celu brakuje ${remaining} ${plural(remaining, "treningu", "treningów", "treningów")}.`;

  if (emptyFirstUse) {
    return (
      <section className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
          Ten tydzień · {formatHistoryWeekRange(monday)}
        </p>
        <p className="mt-2.5 font-heading text-[26px] font-semibold leading-8 text-white">
          Twoja analiza ruszy po pierwszym treningu
        </p>
        <p className="mt-2 text-[14px] leading-5 text-[var(--gym-text-secondary)]">
          Zapisz trening, a tutaj zobaczysz swój tydzień, gotowość i postęp.
        </p>
        <ul className="mt-3 space-y-2 border-t border-white/[0.06] pt-2 text-[14px] leading-5 text-white/85">
          <li>
            <span className="font-semibold text-white">Po 1 treningu:</span>{" "}
            licznik tygodnia i cel.
          </li>
          <li>
            <span className="font-semibold text-white">Po 3 treningach:</span>{" "}
            trend siły w ćwiczeniach.
          </li>
          <li>
            <span className="font-semibold text-white">Po 7 dniach:</span>{" "}
            gotowość do treningu.
          </li>
          <li>
            <span className="font-semibold text-white">
              Po 2 tygodniach wpisów wagi:
            </span>{" "}
            tempo zmian.
          </li>
        </ul>
        <div className="mt-4 flex flex-col gap-2">
          <a
            href="/treningi"
            className="gym-btn-primary flex min-h-12 items-center justify-center rounded-2xl text-[15px] font-semibold"
          >
            Zacznij trening
          </a>
          <a
            href="/progress?tab=sylwetka"
            className="gym-btn-outline flex min-h-12 items-center justify-center rounded-2xl text-[15px] font-semibold"
          >
            Dodaj pierwszy pomiar wagi
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-90 [background:linear-gradient(165deg,rgba(var(--neon-rgb),0.16)_0%,rgba(40,28,8,0.35)_38%,transparent_72%)]"
        aria-hidden
      />
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
          Ten tydzień · {formatHistoryWeekRange(monday)}
        </p>

        <div className="mt-2.5 flex items-end gap-2">
          <AnimatedMetric
            value={done}
            className="text-[2.75rem] leading-none text-white"
          />
          <p className="pb-1 text-[15px] leading-tight text-white/80">
            z {target} {plural(target, "treningu", "treningów", "treningów")}
          </p>
        </div>

        <Meter
          pct={target > 0 ? (done / target) * 100 : 0}
          className="mt-3 h-2"
          aria-label={`Cel: ${done} z ${target}`}
        />
        <p className="mt-2.5 text-[15px] font-medium leading-5 text-white/90">
          {verdict}
        </p>

        <div
          role="list"
          aria-label="Dni tygodnia"
          className="mt-3.5 grid grid-cols-7 gap-1"
        >
          {days.map((d) => (
            <WeekDayCell key={d.date} day={d} isToday={d.date === today} />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
          <span className="text-[12px] text-[var(--gym-text-secondary)]">
            {daysLeftLabel(daysLeft)}
          </span>
          {onOpenWeek ? (
            <button
              type="button"
              onClick={onOpenWeek}
              className="inline-flex min-h-11 items-center font-semibold text-[13px] text-[var(--gym-gold)]"
            >
              Szczegóły tygodnia →
            </button>
          ) : (
            <a
              href="/progress?tab=tydzien"
              className="inline-flex min-h-11 items-center font-semibold text-[13px] text-[var(--gym-gold)]"
            >
              Szczegóły tygodnia →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
