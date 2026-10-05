"use client";

import { cn } from "@/lib/utils";

function MacroCol({
  label,
  consumed,
  goal,
  unit,
  barClass,
}: {
  label: string;
  consumed: number;
  goal: number | null;
  unit: string;
  barClass: string;
}) {
  const pct =
    goal != null && goal > 0
      ? Math.min(100, Math.round((consumed / goal) * 100))
      : 0;
  const over = goal != null && consumed > goal;
  const remaining =
    goal != null && goal > 0 ? Math.round(goal - consumed) : null;

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            over ? "bg-rose-400" : barClass,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </p>
      <p className="mt-0.5 text-[11px] tabular-nums leading-tight text-white/90">
        {Math.round(consumed)}
        {goal != null ? (
          <span className="text-white/40"> / {Math.round(goal)}</span>
        ) : null}{" "}
        <span className="text-white/40">{unit}</span>
      </p>
      {remaining != null ? (
        <p
          className={cn(
            "mt-0.5 text-[10px] tabular-nums leading-tight",
            over ? "text-rose-400" : "text-white/40",
          )}
        >
          {over
            ? `+${Math.abs(remaining)} nadwyżka`
            : `${remaining} zostało`}
        </p>
      ) : null}
    </div>
  );
}

export type DietDayMacrosBarProps = {
  caloriesConsumed: number;
  caloriesGoal: number | null;
  proteinConsumed: number;
  proteinGoal: number | null;
  fatConsumed: number;
  fatGoal: number | null;
  carbsConsumed: number;
  carbsGoal: number | null;
  /** `sticky` — belka dolna; `embedded` — wewnątrz karty dziennika. */
  variant?: "sticky" | "embedded";
  className?: string;
};

/** Pasek makro dnia (kcal / B / T / W + ile zostało). */
export function DietDayMacrosBar({
  caloriesConsumed,
  caloriesGoal,
  proteinConsumed,
  proteinGoal,
  fatConsumed,
  fatGoal,
  carbsConsumed,
  carbsGoal,
  variant = "sticky",
  className,
}: DietDayMacrosBarProps) {
  const embedded = variant === "embedded";

  return (
    <div
      className={cn(
        embedded ? "px-0 py-0" : "bg-[#0a0a0a]/95 px-3 py-2.5 backdrop-blur-md",
        className,
      )}
    >
      <div className={cn("flex gap-3", embedded && "gap-2.5")}>
        <MacroCol
          label="Kcal"
          consumed={caloriesConsumed}
          goal={caloriesGoal}
          unit="kcal"
          barClass="bg-[var(--gym-gold)]"
        />
        <MacroCol
          label="Białka"
          consumed={proteinConsumed}
          goal={proteinGoal}
          unit="g"
          barClass="bg-sky-400"
        />
        <MacroCol
          label="Tł."
          consumed={fatConsumed}
          goal={fatGoal}
          unit="g"
          barClass="bg-amber-400"
        />
        <MacroCol
          label="Węgl."
          consumed={carbsConsumed}
          goal={carbsGoal}
          unit="g"
          barClass="bg-violet-400"
        />
      </div>
    </div>
  );
}
