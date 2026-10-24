import type {
  SessionProgress,
  SessionProgressSegment,
} from "@/lib/workout-session-progress";
import { cn } from "@/lib/utils";

/** Powyżej tylu serii odstępy maleją (60 serii mieści się w 320 px). */
const DENSE_SETS_THRESHOLD = 32;

function segmentClass(seg: SessionProgressSegment): string {
  const tall = seg.isCurrent;
  if (seg.state === "saved") {
    return cn(
      "bg-[var(--gym-success)]",
      tall
        ? "h-2.5 shadow-[0_0_0_1.5px_var(--gym-black),0_0_0_3px_var(--gym-gold)]"
        : "h-1.5",
    );
  }
  if (seg.state === "skipped") {
    return cn(
      "bg-transparent shadow-[inset_0_0_0_1.5px_var(--gym-skipped)]",
      tall ? "h-2.5" : "h-1.5",
    );
  }
  if (seg.state === "current") return "h-2.5 bg-[var(--gym-gold)]";
  return "h-1.5 bg-[var(--gym-track)]";
}

function progressValueText(progress: SessionProgress): string {
  const base = `Zapisano ${progress.savedSets} z ${progress.totalSets} serii`;
  return progress.skippedSets > 0
    ? `${base}, pominięto ${progress.skippedSets}`
    : base;
}

/**
 * Pasek postępu sesji (ekran serii i przerwy): segment = seria, grupa = ćwiczenie.
 * Stany różnią się kształtem, nie tylko kolorem: bieżąca wyższa, pominięta pusta,
 * ćwiczenie zaliczone = ciągła belka.
 */
export function SessionSegmentedProgress({
  progress,
  className,
}: {
  progress: SessionProgress;
  className?: string;
}) {
  const dense = progress.totalSets > DENSE_SETS_THRESHOLD;
  return (
    <div
      role="progressbar"
      aria-label="Postęp treningu"
      aria-valuemin={0}
      aria-valuemax={progress.totalSets}
      aria-valuenow={progress.savedSets}
      aria-valuetext={progressValueText(progress)}
      className={cn(
        "flex h-2.5 items-center",
        dense ? "gap-1" : "gap-1.5",
        className,
      )}
    >
      {progress.groups.map((group) => {
        const bar = group.completed;
        return (
          <div
            key={group.exerciseId}
            aria-hidden
            className={cn(
              "flex min-w-0 items-center",
              bar ? "gap-0" : dense ? "gap-px" : "gap-0.5",
            )}
            style={{ flexGrow: Math.max(1, group.segments.length), flexBasis: 0 }}
          >
            {group.segments.map((seg) => (
              <span
                key={seg.setIndex}
                className={cn(
                  "min-w-[2px] flex-1 transition-colors duration-200 motion-reduce:transition-none",
                  bar
                    ? "first:rounded-l-full last:rounded-r-full"
                    : "rounded-full",
                  segmentClass(seg),
                )}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
