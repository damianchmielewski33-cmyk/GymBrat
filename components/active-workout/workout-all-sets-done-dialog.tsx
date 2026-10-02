"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Flame, RotateCcw, Trophy } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SkippedWorkoutTarget } from "@/lib/workout-skipped-sets";

type Step = "choice" | "cardio";

function skippedCountLabel(count: number): string {
  if (count <= 1) return "1 pominięta seria";
  if (count >= 2 && count <= 4) return `${count} pominięte serie`;
  return `${count} pominiętych serii`;
}

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
  onFinish: (cardioMinutes?: number) => void;
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
  const effectiveSkipCount = Math.max(1, skippedCount);
  const setOrdinal =
    skippedTarget != null ? skippedTarget.setIndex + 1 : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="app-dialog w-[min(92vw,420px)] p-5 text-white sm:p-6">
        {step === "choice" ? (
          <>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
                <Trophy className="h-5 w-5 text-[var(--gym-gold)]" />
              </div>
              <div className="min-w-0">
                <AlertDialogTitle className="text-lg font-semibold leading-tight text-white">
                  Wszystkie serie wykonane
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-1.5 text-sm leading-relaxed text-white/55">
                  {hasSkipped
                    ? "Siłowy blok jest domknięty, ale część serii została pominięta."
                    : "Siłowy trening jest zaliczony. Chcesz dodać cardio, czy zakończyć sesję?"}
                </AlertDialogDescription>
              </div>
            </div>

            {hasSkipped && skippedTarget ? (
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
                    {setOrdinal != null ? (
                      <>
                        Pierwsza do uzupełnienia:{" "}
                        <span className="tabular-nums text-white/75">
                          seria {setOrdinal}
                        </span>
                      </>
                    ) : (
                      "Możesz wrócić i uzupełnić pominięte serie."
                    )}
                  </p>
                </div>
              </div>
            ) : null}

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
                  Wróć do pominiętej serii
                </Button>
              ) : null}
              <Button
                type="button"
                className={
                  hasSkipped
                    ? "h-12 w-full gap-2 border border-white/15 bg-transparent text-white hover:bg-white/[0.04]"
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
                className="h-12 w-full border-white/15 text-white/80 hover:bg-white/[0.04]"
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
                  onFinish(minutes);
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
