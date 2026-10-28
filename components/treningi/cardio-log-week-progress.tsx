"use client";

import { cn } from "@/lib/utils";

export type CardioWeekProgress = {
  minutesCompleted: number;
  goalMinutes: number;
  weekLabel: string;
};

type Props = {
  weekProgress: CardioWeekProgress | null;
  /** Podgląd po zapisie (szacunek klienta), gdy data wpada w bieżący tydzień. */
  previewAfter?: number | null;
};

export function CardioLogWeekProgress({ weekProgress, previewAfter }: Props) {
  if (!weekProgress) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-[13px] text-[var(--gym-text-secondary)]">
          Postęp tygodnia chwilowo niedostępny.
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--gym-text-secondary)]">
          Wpis zapisze się mimo to.
        </p>
      </div>
    );
  }

  const { minutesCompleted, goalMinutes, weekLabel } = weekProgress;
  const pct =
    goalMinutes > 0
      ? Math.min(100, Math.round((minutesCompleted / goalMinutes) * 100))
      : 0;
  const reached = minutesCompleted >= goalMinutes && goalMinutes > 0;
  const first = minutesCompleted === 0;

  return (
    <div className="rounded-2xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface)] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
          Ten tydzień · {weekLabel}
        </p>
        {reached ? (
          <p className="text-[12px] font-semibold text-[var(--gym-success)]">
            Cel zrobiony
          </p>
        ) : null}
      </div>
      <p className="mt-1.5 font-metric text-[22px] tabular-nums leading-none text-white">
        {minutesCompleted}
        <span className="text-[14px] text-[var(--gym-text-secondary)]">
          {" "}
          z {goalMinutes} min
        </span>
      </p>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Postęp cardio: ${minutesCompleted} z ${goalMinutes} minut`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200",
            reached ? "bg-[var(--gym-success)]" : "bg-[var(--gym-gold)]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {first ? (
        <p className="mt-2 text-[12px] text-[var(--gym-text-secondary)]">
          To pierwszy wpis w tym tygodniu.
        </p>
      ) : null}
      {previewAfter != null && previewAfter !== minutesCompleted ? (
        <p className="mt-2 text-[12px] tabular-nums text-white/80">
          {previewAfter >= goalMinutes && goalMinutes > 0
            ? "Cel osiągnięty: "
            : "Po zapisie: "}
          <b className="font-semibold text-white">
            {previewAfter} z {goalMinutes} min
          </b>
        </p>
      ) : null}
    </div>
  );
}
