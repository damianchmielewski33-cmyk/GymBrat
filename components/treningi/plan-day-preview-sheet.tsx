"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { PencilLine, Play } from "lucide-react";
import type { TreningiHubDay } from "@/lib/treningi-hub-data";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatExerciseCount,
  formatMuscleList,
  formatSetsReps,
  planDayDisplayName,
} from "@/lib/treningi-hub-format";
import { cn } from "@/lib/utils";

/** Podgląd ćwiczeń dnia z menu ⋮ (5.3). Ostatnich ciężarów tu nie pokazujemy (ADR 0002). */
export function PlanDayPreviewSheet({
  day,
  open,
  onOpenChange,
  returnFocusRef,
  startDisabled,
  onStart,
}: {
  day: TreningiHubDay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  startDisabled: boolean;
  onStart: (day: TreningiHubDay) => void;
}) {
  const row = day?.row;
  const exercises = row?.plan.exercises ?? [];
  const labels = day?.muscles?.labels ?? [];
  const subtitle = labels.length
    ? `${formatExerciseCount(exercises.length)} · ${formatMuscleList(labels)}`
    : formatExerciseCount(exercises.length);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        finalFocus={returnFocusRef}
        className="mx-auto max-h-[80dvh] max-w-lg gap-0 rounded-t-3xl border-white/10 bg-[var(--gym-surface)] pb-[env(safe-area-inset-bottom)]"
      >
        {row && day ? (
          <>
            <SheetHeader className="pr-14 text-left">
              <SheetTitle className="line-clamp-2 font-heading text-xl text-white [overflow-wrap:anywhere]">
                {`Dzień ${row.dayNumber} · ${planDayDisplayName(row.plan.planName, row.dayNumber)}`}
              </SheetTitle>
              <SheetDescription className="text-[13px] tabular-nums text-white/60">
                {subtitle}
              </SheetDescription>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4">
              {exercises.length === 0 ? (
                <p className="py-3 text-[15px] text-white/70">
                  Ten dzień nie ma jeszcze ćwiczeń.
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {exercises.map((ex) => (
                    <li
                      key={ex.id}
                      className="flex min-h-12 items-center justify-between gap-3 py-2"
                    >
                      <span className="min-w-0 text-[15px] text-white [overflow-wrap:anywhere]">
                        {ex.supersetGroupId ? (
                          <span className="mr-1.5 text-[11px] font-semibold text-[var(--gym-gold)]">
                            <span aria-hidden>SS</span>
                            <span className="sr-only">superseria:</span>
                          </span>
                        ) : null}
                        {ex.name.trim()}
                      </span>
                      <span className="shrink-0 text-[14px] tabular-nums text-white/60">
                        {formatSetsReps(ex.sets, ex.reps)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4">
              {exercises.length === 0 ? (
                <Link
                  href="/profile/workout-plan"
                  className={cn(buttonVariants({ variant: "cta" }), "w-full gap-2")}
                >
                  <PencilLine aria-hidden />
                  Uzupełnij plan
                </Link>
              ) : (
                <Button
                  type="button"
                  variant="cta"
                  className="w-full gap-2"
                  disabled={startDisabled}
                  onClick={() => onStart(day)}
                >
                  <Play className="fill-current" aria-hidden />
                  Rozpocznij trening
                </Button>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
