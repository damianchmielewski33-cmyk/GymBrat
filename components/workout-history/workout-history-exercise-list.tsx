"use client";

import { Star } from "lucide-react";
import type { WorkoutHistoryExercisePreview } from "@/lib/workout-history-overview";
import { formatHistoryKg } from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";

function SetPill({
  index,
  reps,
  weight,
  done,
  isPr,
  isBodyweight,
}: {
  index: number;
  reps: number | null;
  weight: number;
  done: boolean;
  isPr: boolean;
  isBodyweight: boolean;
}) {
  if (!done) {
    return (
      <span
        className="inline-flex h-9 min-w-[72px] items-center justify-center rounded-xl border border-dashed border-white/15 px-2.5 font-metric text-[13px] text-[var(--gym-text-secondary)]"
        aria-label={`Seria ${index + 1}: niewykonana`}
      >
        —
      </span>
    );
  }

  const aria = isBodyweight
    ? `Seria ${index + 1}: ${reps ?? "—"} powtórzeń, masa ciała${isPr ? ", rekord" : ""}`
    : `Seria ${index + 1}: ${weight} kilogramów na ${reps ?? "—"} powtórzeń${isPr ? ", rekord" : ""}`;

  return (
    <span
      className={cn(
        "inline-flex h-9 min-w-[72px] items-center justify-center gap-1 rounded-xl border px-2.5 font-metric text-[13px] tabular-nums",
        isPr
          ? "border-[var(--gym-gold)] bg-[rgba(235,196,74,0.1)] font-semibold text-[var(--gym-gold)]"
          : "border-white/14 text-white/80",
      )}
      aria-label={aria}
    >
      {isPr ? <Star className="h-3 w-3 shrink-0" aria-hidden /> : null}
      {isBodyweight ? (
        <>{reps ?? "—"} powt.</>
      ) : (
        <>
          {weight}
          <span className="text-[var(--gym-text-secondary)]">×</span>
          {reps ?? "—"}
        </>
      )}
    </span>
  );
}

export function WorkoutHistoryExerciseList({
  exercises,
}: {
  exercises: WorkoutHistoryExercisePreview[];
}) {
  const hasPr = exercises.some((ex) => ex.sets.some((s) => s.isPr));

  if (exercises.length === 0) {
    return (
      <p className="text-[13px] text-[var(--gym-text-secondary)]">
        Nie udało się odczytać szczegółów
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {hasPr ? (
        <p className="flex items-center gap-1.5 text-[12px] leading-4 text-[var(--gym-text-secondary)]">
          <Star className="h-3.5 w-3.5 text-[var(--gym-gold)]" aria-hidden />
          <span>
            <b className="font-semibold text-white">Rekord</b> — nowe najlepsze e1RM
            w ćwiczeniu.
          </span>
        </p>
      ) : null}

      <ol className="space-y-3">
        {exercises.map((ex) => (
          <li key={ex.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-[14px] font-medium leading-5 text-white/90 line-clamp-2">
                {ex.name}
              </p>
              <p className="shrink-0 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
                {ex.isBodyweight ? "masa ciała" : formatHistoryKg(ex.volumeKg)}
              </p>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ex.sets.map((s, i) => (
                <SetPill
                  key={i}
                  index={i}
                  reps={s.reps}
                  weight={s.weight}
                  done={s.done}
                  isPr={s.isPr}
                  isBodyweight={ex.isBodyweight}
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
