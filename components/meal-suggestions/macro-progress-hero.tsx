"use client";

import { AnimatedMetric } from "@/components/ui/animated-metric";
import { cn } from "@/lib/utils";

export type MacroAmount = {
  consumed: number;
  goal: number | null;
};

export type MacroProgressHeroProps = {
  /** Np. „Zjedzone” (Dziennik) albo „Dziś zostało” (Przepisy). */
  label: string;
  calories: MacroAmount;
  protein: MacroAmount;
  carbs: MacroAmount;
  fat: MacroAmount;
  /**
   * `eaten` — pierścień i liczby = zjedzone / cel (Dziennik).
   * `remaining` — środek i wiersze B/W/T = zostało (cel − zjedzone); pierścień nadal postęp dnia.
   */
  mode?: "eaten" | "remaining";
  /** Opóźnienie wejścia animacji (sekundy). */
  enterDelay?: number;
  className?: string;
};

/**
 * Wspólny hero makro (Dziennik i Przepisy): duża liczba kcal + trzy paski B/W/T.
 * Złoty gradient w normie, pomarańcz po przekroczeniu celu.
 */
export function MacroProgressHero({
  label,
  calories,
  protein,
  carbs,
  fat,
  className,
}: MacroProgressHeroProps) {
  const kcalGoal = calories.goal;
  const kcalEaten = Math.round(calories.consumed);
  const kcalRemaining = kcalGoal != null ? Math.round(kcalGoal - kcalEaten) : null;
  const overGoal = kcalRemaining != null && kcalRemaining < 0;
  const big =
    kcalRemaining != null ? Math.abs(kcalRemaining) : kcalEaten;
  const bigLabel =
    kcalRemaining == null
      ? "kcal zjedzone"
      : overGoal
        ? "kcal ponad cel"
        : "kcal zostało";

  const rows = [
    { label: "Białko", short: "B", amount: protein, bar: "bg-sky-400", dot: "bg-sky-400" },
    { label: "Węgle", short: "W", amount: carbs, bar: "bg-amber-300", dot: "bg-amber-300" },
    { label: "Tłuszcz", short: "T", amount: fat, bar: "bg-rose-300", dot: "bg-rose-300" },
  ].map(({ label: name, amount, bar, dot }) => {
    const got = Math.round(amount.consumed);
    const goal = amount.goal != null ? Math.round(amount.goal) : null;
    const over = goal != null && got > goal;
    return {
      name,
      bar,
      dot,
      got,
      goal,
      over,
      diff: goal != null ? Math.abs(goal - got) : null,
      pct: goal != null && goal > 0 ? Math.min(100, (got / goal) * 100) : 0,
    };
  });
  const kcalPct =
    kcalGoal != null && kcalGoal > 0
      ? Math.min(100, (kcalEaten / kcalGoal) * 100)
      : 0;

  return (
    <section
      aria-label={label}
      className={cn("app-card gold-sheen p-4", className)}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            {label}
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <AnimatedMetric
              value={big}
              durationMs={800}
              className={cn(
                "text-[52px] leading-none",
                overGoal ? "text-orange-300" : "text-white",
              )}
            />
            <span className="text-[13px] text-white/60">{bigLabel}</span>
          </p>
        </div>
        <div className="shrink-0 pb-1 text-right text-[12px] tabular-nums text-white/55">
          {kcalGoal != null ? (
            <>
              <span className="text-[15px] font-semibold text-white">{kcalEaten}</span>
              {" / "}
              {Math.round(kcalGoal)} kcal
            </>
          ) : (
            "Ustaw cel w profilu"
          )}
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
            overGoal ? "bg-orange-400" : "gym-meter-gold",
          )}
          style={{ width: `${kcalPct}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-3.5">
        {rows.map((r) => (
          <div key={r.name} className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/60">
              <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", r.dot)} />
              {r.name}
            </p>
            <p className="mt-1 text-[13px] tabular-nums text-white/55">
              <span className="text-[17px] font-semibold text-white">{r.got}</span>
              {r.goal != null ? ` / ${r.goal}` : ""} g
            </p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                  r.over ? "bg-orange-400" : r.bar,
                )}
                style={{ width: `${r.pct}%` }}
              />
            </div>
            <p
              className={cn(
                "mt-1 text-[11px] tabular-nums",
                r.over ? "text-orange-300" : "text-white/50",
              )}
            >
              {r.diff == null
                ? "Brak celu"
                : r.over
                  ? `+${r.diff} g`
                  : `${r.diff} g zostało`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
