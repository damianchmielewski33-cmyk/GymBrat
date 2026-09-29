"use client";

import { useEffect, useState } from "react";
import { Flame, RotateCcw, Trophy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SkippedWorkoutTarget } from "@/lib/workout-skipped-sets";

type Step = "choice" | "cardio";

export function WorkoutAllSetsDoneDialog({
  open,
  onOpenChange,
  initialCardioMinutes,
  onFinish,
  onConfirmCardio,
  skippedTarget = null,
  skippedCount = 0,
  onGoToSkipped,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCardioMinutes: number;
  onFinish: () => void;
  onConfirmCardio: (minutes: number) => void;
  skippedTarget?: SkippedWorkoutTarget | null;
  skippedCount?: number;
  onGoToSkipped?: () => void;
}) {
  const [step, setStep] = useState<Step>("choice");
  const [minutes, setMinutes] = useState(
    initialCardioMinutes > 0 ? initialCardioMinutes : 20,
  );

  useEffect(() => {
    if (!open) return;
    setStep("choice");
    setMinutes(initialCardioMinutes > 0 ? initialCardioMinutes : 20);
  }, [open, initialCardioMinutes]);

  const hasSkipped = Boolean(skippedTarget && onGoToSkipped);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="app-dialog w-[min(92vw,420px)] text-white">
        {step === "choice" ? (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
                <Trophy className="h-5 w-5 text-[var(--gym-gold)]" />
              </div>
              <div className="min-w-0">
                <AlertDialogTitle className="text-white">
                  Wszystkie serie wykonane
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-1.5 text-white/55">
                  {hasSkipped ? (
                    <>
                      Masz pominięte serie
                      {skippedCount > 1 ? ` (${skippedCount})` : ""}. Możesz wrócić do{" "}
                      <span className="font-medium text-white/85">
                        {skippedTarget!.exerciseName}
                      </span>{" "}
                      albo zakończyć sesję.
                    </>
                  ) : (
                    <>
                      Siłowy trening jest zaliczony. Chcesz dodać cardio, czy zakończyć
                      sesję?
                    </>
                  )}
                </AlertDialogDescription>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              {hasSkipped ? (
                <Button
                  type="button"
                  className="gym-btn-primary h-12 w-full gap-2"
                  onClick={() => {
                    onOpenChange(false);
                    onGoToSkipped?.();
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Wróć do: {skippedTarget!.exerciseName}
                </Button>
              ) : null}
              <Button
                type="button"
                className={
                  hasSkipped
                    ? "h-12 w-full gap-2 border border-white/15 bg-transparent"
                    : "gym-btn-primary h-12 w-full gap-2"
                }
                variant={hasSkipped ? "outline" : "default"}
                onClick={() => setStep("cardio")}
              >
                <Flame className="h-4 w-4" />
                Rozpocznij / dodaj cardio
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full border-white/15"
                onClick={() => {
                  onOpenChange(false);
                  onFinish();
                }}
              >
                Zakończ trening
              </Button>
            </div>
          </>
        ) : (
          <>
            <AlertDialogTitle className="text-white">Cardio po siłowym</AlertDialogTitle>
            <AlertDialogDescription className="mt-1 text-white/55">
              Podaj czas cardio — zapisze się wraz z treningiem.
            </AlertDialogDescription>
            <div className="mt-5 flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Mniej minut"
                onClick={() => setMinutes((m) => Math.max(1, m - 5))}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-xl text-white"
              >
                −
              </button>
              <p className="min-w-[5rem] text-center font-display text-4xl tabular-nums text-[var(--gym-gold)]">
                {minutes}
                <span className="ml-1 text-base text-white/45">min</span>
              </p>
              <button
                type="button"
                aria-label="Więcej minut"
                onClick={() => setMinutes((m) => Math.min(180, m + 5))}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-xl text-white"
              >
                +
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="button"
                className="gym-btn-primary h-12 w-full"
                onClick={() => {
                  onConfirmCardio(minutes);
                  onOpenChange(false);
                  onFinish();
                }}
              >
                Zapisz cardio i zakończ
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full border-white/15"
                onClick={() => setStep("choice")}
              >
                Wróć
              </Button>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
