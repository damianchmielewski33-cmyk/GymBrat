"use client";

import { useRef } from "react";
import { Circle, ListChecks, SkipForward } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";
import type { SkippedWorkoutTarget } from "@/lib/workout-skipped-sets";

type SkippedDialogVariant = "skipped" | "incomplete" | "both";

function resolveVariant(skippedCount: number, incompleteCount: number): SkippedDialogVariant {
  if (skippedCount > 0 && incompleteCount > 0) return "both";
  if (incompleteCount > 0) return "incomplete";
  return "skipped";
}

/**
 * Tytuł wg D-1 (raport ux, potwierdzone przez koordynatora): „Nie wszystkie serie
 * wykonane” gdy są RÓWNOCZEŚNIE pominięte i niewykonane serie (wariant `both`) albo
 * tylko niewykonane (`incomplete`) — tytuł „Zostały pominięte serie” zostaje prawdziwy
 * tylko dla czystego wariantu `skipped` (blok jest wtedy faktycznie domknięty).
 */
function titleForVariant(variant: SkippedDialogVariant): string {
  return variant === "skipped" ? "Zostały pominięte serie" : "Nie wszystkie serie wykonane";
}

function descriptionForVariant(variant: SkippedDialogVariant): string {
  if (variant === "skipped") {
    return "Blok siłowy jest zamknięty. Pominięte serie nie wejdą do tonażu.";
  }
  if (variant === "incomplete") {
    return "Niewykonane serie nie wejdą do tonażu.";
  }
  return "Pominięte i niewykonane serie nie wejdą do tonażu.";
}

export function WorkoutAllSetsDoneDialog({
  open,
  onOpenChange,
  onFinish,
  onGoToSkipped,
  target,
  skippedCount,
  incompleteCount,
  zeroCompleted = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** „Zakończ i zapisz” — wywołuje `flow.confirmFinishFromDialog()`. */
  onFinish: () => void;
  /** „Wróć do serii” — wywołuje `flow.goToSkippedTarget()`. */
  onGoToSkipped: () => void;
  target: SkippedWorkoutTarget;
  skippedCount: number;
  incompleteCount: number;
  /** Q5: żadna seria w sesji nie została naprawdę zaliczona — dopisek „bez tonażu”. */
  zeroCompleted?: boolean;
}) {
  const variant = resolveVariant(skippedCount, incompleteCount);
  const setOrdinal = target.setIndex + 1;
  const safeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <AppDialog
      open={open}
      onOpenChange={(next) => {
        // Esc / tapnięcie poza dialogiem = jak „Wróć do serii” (006.3) — bez zapisu.
        if (!next) onGoToSkipped();
        onOpenChange(next);
      }}
      role="alertdialog"
      tone="gold"
      icon={ListChecks}
      initialFocus={safeButtonRef}
      title={titleForVariant(variant)}
      description={descriptionForVariant(variant)}
    >
        <dl className="mt-4 w-full overflow-hidden rounded-2xl border border-white/10 divide-y divide-white/[0.06] text-left">
          {skippedCount > 0 ? (
            <div className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5">
              <dt className="flex items-center gap-2 text-sm text-white/80">
                <SkipForward className="h-4 w-4 text-[var(--gym-skipped)]" aria-hidden />
                Pominięte serie
              </dt>
              <dd
                className="font-metric text-[20px] tabular-nums text-[var(--gym-skipped)]"
                aria-label={`${skippedCount} pominiętych serii`}
              >
                {skippedCount}
              </dd>
            </div>
          ) : null}
          {incompleteCount > 0 ? (
            <div className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5">
              <dt className="flex items-center gap-2 text-sm text-white/80">
                <Circle className="h-4 w-4 text-[var(--gym-text-secondary)]" aria-hidden />
                Niewykonane serie
              </dt>
              <dd
                className="font-metric text-[20px] tabular-nums text-white/80"
                aria-label={`${incompleteCount} niewykonanych serii`}
              >
                {incompleteCount}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
            Pierwsza do uzupełnienia
          </p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-white line-clamp-2">
            {target.exerciseName}
          </p>
          <p className="text-[13px] tabular-nums text-[var(--gym-text-secondary)]">
            seria {setOrdinal}
          </p>
        </div>

        {zeroCompleted ? (
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--gym-text-secondary)]">
            Nie zaliczono żadnej serii. Trening zapisze się bez tonażu.
          </p>
        ) : null}

        <AppDialogActions>
          <AppDialogButton
            intent="primary"
            onClick={() => {
              onOpenChange(false);
              onFinish();
            }}
          >
            Zakończ i zapisz
          </AppDialogButton>
          <AppDialogButton
            ref={safeButtonRef}
            onClick={() => {
              onGoToSkipped();
              onOpenChange(false);
            }}
          >
            Wróć do serii
          </AppDialogButton>
        </AppDialogActions>
    </AppDialog>
  );
}
