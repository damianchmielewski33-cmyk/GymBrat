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

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            over ? "bg-rose-400" : barClass,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
        {label}
      </p>
      <p className="mt-0.5 text-[11px] tabular-nums leading-tight text-white/85">
        {Math.round(consumed)}
        {goal != null ? ` / ${Math.round(goal)}` : ""} {unit}
      </p>
    </div>
  );
}

/** Sticky pasek makro dnia — jak w Fitatu. */
export function DietDayMacrosBar({
  caloriesConsumed,
  caloriesGoal,
  proteinConsumed,
  proteinGoal,
  fatConsumed,
  fatGoal,
  carbsConsumed,
  carbsGoal,
}: {
  caloriesConsumed: number;
  caloriesGoal: number | null;
  proteinConsumed: number;
  proteinGoal: number | null;
  fatConsumed: number;
  fatGoal: number | null;
  carbsConsumed: number;
  carbsGoal: number | null;
}) {
  return (
    <div className="border-t border-white/10 bg-[#0a0a0a]/95 px-3 py-2.5 backdrop-blur-md">
      <div className="flex gap-3">
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
