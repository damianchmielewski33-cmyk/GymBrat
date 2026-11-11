"use client";

import { useEffect, useState } from "react";
import { formatPlNumber } from "@/lib/nutrition-day-balance";
import { cn } from "@/lib/utils";

const SIZE = 148;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * Pierścień realizacji celu kcal. Pierwszy obieg = do 100% (złoty),
 * drugi (cieńszy, biały) = nadwyżka. Wypełnia się animacją po wejściu.
 */
export function MacroRing({
  consumed,
  goal,
  unit = "kcal",
  className,
}: {
  consumed: number;
  goal: number | null;
  unit?: string;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const pct = goal != null && goal > 0 ? (consumed / goal) * 100 : 0;
  const first = ready ? Math.min(100, pct) : 0;
  const second = ready ? Math.min(100, Math.max(0, pct - 100)) : 0;
  const rounded = Math.round(pct);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={
        goal != null
          ? `${formatPlNumber(consumed)} z ${formatPlNumber(goal)} ${unit}, ${rounded} procent celu`
          : `${formatPlNumber(consumed)} ${unit}, brak celu`
      }
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--gym-track)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--gym-gold)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - first / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={STROKE / 2.5}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - second / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-metric text-[30px] leading-none tabular-nums text-[var(--gym-gold)]">
          {goal != null ? `${rounded}%` : formatPlNumber(consumed)}
        </span>
        <span className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
          {goal != null ? "celu kcal" : unit}
        </span>
      </div>
    </div>
  );
}
