import Link from "next/link";
import type { Ref } from "react";
import { PencilLine, Play } from "lucide-react";
import type { ExerciseLastLoad } from "@/lib/plan-last-session-loads";
import type { TreningiHubDay } from "@/lib/treningi-hub-data";
import { Button, buttonVariants } from "@/components/ui/button";
import { MuscleGlyph } from "@/components/treningi/muscle-glyph";
import {
  MainCardShell,
  mainCardKickerClass,
  mainCardTitleClass,
} from "@/components/treningi/main-card-shell";
import {
  NEXT_CARD_EXERCISE_PREVIEW,
  formatLastLoad,
  formatLastLoadAria,
  formatMoreExercises,
  formatMusclesSentence,
  formatNextWorkoutMeta,
  formatPlanTarget,
  formatPlanTargetAria,
  planDayDisplayName,
} from "@/lib/treningi-hub-format";
import { cn } from "@/lib/utils";

const TITLE_ID = "next-workout-title";
const NEXT_CARD_COMPACT_PREVIEW = 1;

/** Karta „Następny · Dzień N” (4A) i wariant „Dzień N jest pusty” (4C). */
export function NextWorkoutCard({
  day,
  todayKey,
  lastLoads,
  starting,
  startDisabled,
  onStart,
  titleRef,
}: {
  day: TreningiHubDay;
  todayKey: string;
  lastLoads: Readonly<Record<string, ExerciseLastLoad>>;
  /** Ta karta właśnie startuje sesję (wybór solo/grupa otwarty). */
  starting: boolean;
  /** Inny start w toku — cel nieaktywny. */
  startDisabled: boolean;
  onStart: () => void;
  titleRef?: Ref<HTMLHeadingElement>;
}) {
  const { row, muscles } = day;
  const exercises = row.plan.exercises;
  const kicker = `Następny · Dzień ${row.dayNumber}`;

  if (exercises.length === 0) {
    return (
      <MainCardShell titleId={TITLE_ID}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className={mainCardKickerClass}>{kicker}</p>
            <h2 id={TITLE_ID} ref={titleRef} tabIndex={-1} className={mainCardTitleClass}>
              Dzień {row.dayNumber} jest pusty
            </h2>
            <p className="mt-1.5 text-[13px] text-white/65">
              Dodaj ćwiczenia, żeby zacząć trening z planu.
            </p>
          </div>
          <MuscleGlyph summary={null} size="hero" />
        </div>
        <Link
          href="/profile/workout-plan"
          className={cn(buttonVariants({ variant: "cta" }), "mt-4 w-full gap-2")}
        >
          <PencilLine aria-hidden />
          Uzupełnij plan
        </Link>
      </MainCardShell>
    );
  }

  const name = planDayDisplayName(row.plan.planName, row.dayNumber);
  const preview = exercises.slice(0, NEXT_CARD_EXERCISE_PREVIEW);
  const moreCount = exercises.length - preview.length;

  return (
    <MainCardShell titleId={TITLE_ID}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={mainCardKickerClass}>{kicker}</p>
          <h2
            id={TITLE_ID}
            ref={titleRef}
            tabIndex={-1}
            className={mainCardTitleClass}
            title={name}
          >
            {name}
          </h2>
          <p className="mt-1.5 text-[13px] tabular-nums text-white/60">
            {formatNextWorkoutMeta(exercises.length, row.lastWorkoutDate, todayKey)}
          </p>
          <span className="sr-only">{formatMusclesSentence(muscles?.labels ?? null)}</span>
        </div>
        <MuscleGlyph summary={muscles} size="hero" />
      </div>

      <ul className="mt-3 border-t compact:mt-2 border-white/[0.06]">
        {preview.map((ex, index) => {
          const exName = ex.name.trim();
          const load = lastLoads[ex.id];
          const aria = load
            ? formatLastLoadAria(exName, load)
            : formatPlanTargetAria(exName, ex.sets, ex.reps);
          return (
            <li
              key={ex.id}
              className={cn(
                "flex min-h-8 items-center justify-between gap-3 border-b border-white/[0.06]",
                // Niski ekran: 1 ćwiczenie (budżet wysokości, AC-6.4).
                index >= NEXT_CARD_COMPACT_PREVIEW && "compact:hidden",
              )}
            >
              <span aria-hidden className="truncate text-[14px] text-white/85" title={exName}>
                {exName}
              </span>
              <span
                aria-hidden
                className={cn(
                  "shrink-0 text-[14px] tabular-nums",
                  load ? "font-semibold text-white" : "font-normal text-white/60",
                )}
              >
                {load ? formatLastLoad(load) : formatPlanTarget(ex.sets, ex.reps)}
              </span>
              <span className="sr-only">{aria}</span>
            </li>
          );
        })}
      </ul>
      {moreCount > 0 ? (
        <p className="mt-2 text-[12px] text-white/60 compact:hidden">
          {formatMoreExercises(moreCount)}
        </p>
      ) : null}

      <Button
        type="button"
        variant="cta"
        className="mt-4 w-full gap-2 compact:mt-3"
        disabled={starting || startDisabled}
        aria-busy={starting || undefined}
        onClick={onStart}
      >
        <Play className="fill-current" aria-hidden />
        {starting ? "Startuję…" : "Rozpocznij trening"}
      </Button>
    </MainCardShell>
  );
}
