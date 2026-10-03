"use client";

import { AlertTriangle, RotateCcw, Trophy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SkippedWorkoutTarget } from "@/lib/workout-skipped-sets";

function skippedCountLabel(count: number): string {
  if (count <= 1) return "1 pominięta seria";
  if (count >= 2 && count <= 4) return `${count} pominięte serie`;
  return `${count} pominiętych serii`;
}

/**
 * Dialog tylko przy pominiętych seriach.
 * Cardio jest wyłącznie na ekranie „Trening zrobiony”.
 */
export function WorkoutAllSetsDoneDialog({
  open,
  onOpenChange,
  onFinish,
  skippedTarget,
  skippedCount = 0,
  onGoToSkipped,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinish: () => void;
  skippedTarget: SkippedWorkoutTarget;
  skippedCount?: number;
  onGoToSkipped: () => void;
}) {
  const effectiveSkipCount = Math.max(1, skippedCount);
  const setOrdinal = skippedTarget.setIndex + 1;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="app-dialog w-[min(92vw,420px)] p-5 text-white sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
            <Trophy className="h-5 w-5 text-[var(--gym-gold)]" />
          </div>
          <div className="min-w-0">
            <AlertDialogTitle className="text-lg font-semibold leading-tight text-white">
              Wszystkie serie wykonane
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1.5 text-sm leading-relaxed text-white/55">
              Siłowy blok jest domknięty, ale część serii została pominięta.
            </AlertDialogDescription>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/[0.08]">
          <div className="flex items-center gap-2 border-b border-[var(--gym-gold)]/20 px-3.5 py-2.5">
            <AlertTriangle
              className="h-4 w-4 shrink-0 text-[var(--gym-gold)]"
              aria-hidden
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
              {skippedCountLabel(effectiveSkipCount)}
            </p>
          </div>
          <div className="space-y-1 px-3.5 py-3">
            <p className="text-[15px] font-semibold leading-snug text-white">
              {skippedTarget.exerciseName}
            </p>
            <p className="text-sm text-white/50">
              Pierwsza do uzupełnienia:{" "}
              <span className="tabular-nums text-white/75">
                seria {setOrdinal}
              </span>
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            className="gym-btn-primary h-12 w-full gap-2"
            onClick={() => {
              // Najpierw nawigacja (target w store), potem zamknięcie dialogu.
              onGoToSkipped();
              onOpenChange(false);
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Wróć do pominiętej serii
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full border-white/15 text-white/80 hover:bg-white/[0.04]"
            onClick={() => {
              onOpenChange(false);
              onFinish();
            }}
          >
            Zakończ trening
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
