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
    { label: "Białko", amount: protein },
    { label: "Węglowodany", amount: carbs },
    { label: "Tłuszcze", amount: fat },
  ].map(({ label: name, amount }) => {
    const got = Math.round(amount.consumed);
    const goal = amount.goal != null ? Math.round(amount.goal) : null;
    const over = goal != null && got > goal;
    return {
      name,
      got,
      goal,
      over,
      diff: goal != null ? Math.abs(goal - got) : null,
      pct: goal != null && goal > 0 ? Math.min(100, (got / goal) * 100) : 0,
    };
  });

  return (
    <section
      aria-label={label}
      className={cn("app-card gold-sheen p-5", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-white/60">{label}</p>
        {kcalGoal == null ? (
          <p className="text-xs text-white/60">Ustaw cel w profilu</p>
        ) : null}
      </div>

      <p className="mt-3 flex items-baseline gap-2">
        <AnimatedMetric
          value={big}
          durationMs={800}
          className={cn(
            "text-[64px] leading-none",
            overGoal ? "text-orange-300" : "text-white",
          )}
        />
        <span className="text-[15px] text-white/60">{bigLabel}</span>
      </p>
      {kcalGoal != null ? (
        <p className="mt-1 text-[13px] text-white/60 tabular-nums">
          Zjedzone {kcalEaten} z {Math.round(kcalGoal)} kcal
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-white">{r.name}</span>
              <span className="text-white/60 tabular-nums">
                <span className="text-white">{r.got}</span>
                {r.goal != null ? ` / ${r.goal}` : ""}&nbsp;g
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                  r.over ? "bg-orange-400" : "gym-meter-gold",
                )}
                style={{ width: `${r.pct}%` }}
              />
            </div>
            <p
              className={cn(
                "mt-1.5 text-[13px]",
                r.over ? "text-orange-300" : "text-white/60",
              )}
            >
              {r.diff == null
                ? "Brak celu"
                : r.over
                  ? `${r.diff} g ponad cel`
                  : `${r.diff} g zostało`}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
