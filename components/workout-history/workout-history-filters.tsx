"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanFilterKey } from "@/components/workout-history/use-workout-history-filter";

type PlanFilter = { id: string; label: string; count: number };

type Props = {
  planFilters: PlanFilter[];
  filterPlanKey: PlanFilterKey;
  onChange: (key: PlanFilterKey) => void;
  totalCount: number;
  shownCount: number;
};

function workoutsWord(n: number): string {
  if (n === 1) return "trening";
  if (n >= 2 && n <= 4) return "treningi";
  return "treningów";
}

export function WorkoutHistoryFilters({
  planFilters,
  filterPlanKey,
  onChange,
  totalCount,
  shownCount,
}: Props) {
  const activeLabel =
    filterPlanKey === "all"
      ? null
      : (planFilters.find((p) => p.id === filterPlanKey)?.label ?? null);

  return (
    <div className="mt-3">
      <div
        role="group"
        aria-label="Filtr dnia planu"
        className={cn(
          "chip-scroll sticky top-0 z-[1] -mx-4 bg-[var(--gym-black)]/85 px-4 py-2 backdrop-blur-md",
          "[mask-image:linear-gradient(90deg,#000_90%,transparent)]",
        )}
      >
        <Chip
          pressed={filterPlanKey === "all"}
          label="Wszystkie"
          count={totalCount}
          ariaLabel={`Wszystkie, ${totalCount} ${workoutsWord(totalCount)}`}
          onClick={() => onChange("all")}
        />
        {planFilters.map((p) => (
          <Chip
            key={p.id}
            pressed={filterPlanKey === p.id}
            label={p.label}
            count={p.count}
            ariaLabel={`${p.label}, ${p.count} ${workoutsWord(p.count)}`}
            onClick={() => onChange(p.id)}
          />
        ))}
      </div>

      <div className="resbar flex min-h-11 items-center justify-between gap-2 text-[12px] text-[var(--gym-text-secondary)]">
        <p className="tabular-nums">
          Pokazano{" "}
          <b className="font-semibold text-white">{shownCount}</b>{" "}
          {workoutsWord(shownCount)}
          {activeLabel ? (
            <span className="text-[var(--gym-text-secondary)]">
              {" "}
              · {activeLabel}
            </span>
          ) : null}
        </p>
        {filterPlanKey !== "all" ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1 px-2 text-[13px] font-semibold text-[var(--gym-gold)]"
            onClick={() => onChange("all")}
          >
            Wyczyść filtr
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  pressed,
  label,
  count,
  ariaLabel,
  onClick,
}: {
  pressed: boolean;
  label: string;
  count: number;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
        pressed
          ? "scale-[1.03] border-[#f6e3a1]/80 bg-gradient-to-b from-[#f6e3a1] to-[var(--gym-gold)] text-[var(--neon-fg)] shadow-[0_4px_14px_rgba(var(--neon-rgb),0.35)]"
          : "border-white/10 bg-white/[0.05] text-white/80",
      )}
    >
      {pressed ? (
        <Check
          className="h-3.5 w-3.5"
          aria-hidden
        />
      ) : null}
      <span>{label}</span>
      <span
        className={cn(
          "text-[12px] tabular-nums",
          pressed ? "opacity-70" : "text-[var(--gym-text-secondary)]",
        )}
      >
        {count}
      </span>
    </button>
  );
}
