"use client";

import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Potwierdzenie zamknięcia sesji bez zapisu (zamiast window.confirm).
 */
export function WorkoutDiscardSessionDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="app-dialog w-[min(92vw,420px)] p-5 text-white sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-400/10">
            <AlertTriangle className="h-5 w-5 text-amber-300" aria-hidden />
          </div>
          <div className="min-w-0">
            <AlertDialogTitle className="text-lg font-semibold leading-tight text-white">
              Zakończyć bez zapisu?
            </AlertDialogTitle>
            <AlertDialogDescription className="mt-1.5 text-sm leading-relaxed text-white/55">
              Postęp z tej sesji nie zostanie zapisany. Ciężary i powtórzenia
              znikną z tego treningu.
            </AlertDialogDescription>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 sm:flex-none"
            onClick={() => onOpenChange(false)}
          >
            Anuluj
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-12 flex-1 sm:flex-none"
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Zakończ bez zapisu
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
