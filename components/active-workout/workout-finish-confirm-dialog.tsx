"use client";

/**
 * Dialog „Zakończyć trening?” (005 sekcja 7, D-3 koordynatora): jedno dodatkowe
 * potwierdzenie przed `requestFinish()`, pokazywane wyłącznie z paska globalnego i menu
 * sesji, gdy nie są pominięte/niewykonane serie (w tym przypadku dialog pominiętych,
 * sekcja 6, pokazuje się bez tego dodatkowego pytania).
 */
import { useRef } from "react";
import { CircleCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function WorkoutFinishConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** „Zakończ i zapisz” — wywołuje `flow.requestFinish()`. */
  onConfirm: () => void;
  busy?: boolean;
}) {
  const safeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        role="alertdialog"
        className="app-dialog w-[min(92vw,420px)] p-5 text-white sm:p-6"
        initialFocus={safeButtonRef}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10">
            <CircleCheck className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
          </div>
          <div className="min-w-0">
            <AlertDialogTitle className="font-heading text-[20px] font-semibold leading-tight text-white">
              Zakończyć trening?
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1.5 text-sm leading-relaxed text-[var(--gym-text-secondary)]">
              Trening zostanie zapisany, a potem zobaczysz podsumowanie.
            </AlertDialogDescription>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <Button
            type="button"
            variant="outline"
            ref={safeButtonRef}
            disabled={busy}
            className="h-12 w-full border-[var(--gym-border-gold)] text-white/90"
            onClick={() => onOpenChange(false)}
          >
            Wróć do treningu
          </Button>
          <Button
            type="button"
            variant="cta"
            disabled={busy}
            className="h-14 w-full"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            {busy ? "Zapisuję…" : "Zakończ i zapisz"}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
