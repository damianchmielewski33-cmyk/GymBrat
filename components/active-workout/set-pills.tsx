"use client";

import { useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";
import type { WorkoutSetState } from "@/components/workout/types";
import type { SessionProgressSegment } from "@/lib/workout-session-progress";
import { formatKgPl } from "@/lib/set-progression-suggestion";
import { cn } from "@/lib/utils";

/** Powyżej tylu serii pigułki przewijają się poziomo. */
const SCROLL_PILLS_THRESHOLD = 8;

function pillLabel(
  seg: SessionProgressSegment,
  set: WorkoutSetState | undefined,
  selected: boolean,
): string {
  const n = seg.setIndex + 1;
  let label: string;
  if (seg.state === "saved") {
    const reps = set?.reps != null && set.reps > 0 ? ` × ${set.reps}` : "";
    label = `Seria ${n}, zapisana: ${formatKgPl(set?.weight ?? 0)} kg${reps}`;
  } else if (seg.state === "skipped") {
    label = `Seria ${n}, pominięta`;
  } else if (selected) {
    return `Seria ${n}, bieżąca`;
  } else {
    return `Seria ${n}, do zrobienia`;
  }
  return selected ? `${label}, edytujesz` : label;
}

/** Pigułki serii ćwiczenia: numer / ✓ / – oraz złoty pierścień edytowanej. */
export function SetPills({
  segments,
  sets,
  activeSetIndex,
  onSelect,
}: {
  segments: SessionProgressSegment[];
  sets: WorkoutSetState[];
  activeSetIndex: number;
  onSelect: (setIndex: number) => void;
}) {
  const scroll = segments.length > SCROLL_PILLS_THRESHOLD;
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!scroll) return;
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [scroll, activeSetIndex]);

  return (
    <div
      role="group"
      aria-label="Serie ćwiczenia"
      className={cn("flex items-center", scroll ? "chip-scroll max-w-full" : "shrink-0")}
    >
      {segments.map((seg) => {
        const selected = seg.setIndex === activeSetIndex;
        return (
          <button
            key={seg.setIndex}
            type="button"
            aria-pressed={selected}
            aria-label={pillLabel(seg, sets[seg.setIndex], selected)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(seg.setIndex)}
            ref={selected ? selectedRef : undefined}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center"
          >
            <span
              aria-hidden
              className={cn(
                "inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border text-[14px] font-bold tabular-nums transition-colors duration-200 motion-reduce:transition-none",
                seg.state === "saved"
                  ? "border-[var(--gym-success)]/60 bg-[var(--gym-success)]/14 text-[var(--gym-success)]"
                  : seg.state === "skipped"
                    ? "border-[var(--gym-skipped)]/60 bg-[var(--gym-skipped)]/12 text-[var(--gym-skipped)]"
                    : selected
                      ? "border-[var(--gym-gold)] bg-[var(--gym-gold)]/18 text-[var(--gym-gold-bright)]"
                      : "border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-white/80",
                selected &&
                  "shadow-[0_0_0_2px_var(--gym-black),0_0_0_4px_var(--gym-gold)]",
              )}
            >
              {seg.state === "saved" ? (
                <Check className="size-4" strokeWidth={2.5} />
              ) : seg.state === "skipped" ? (
                <Minus className="size-4" strokeWidth={2.5} />
              ) : (
                seg.setIndex + 1
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
