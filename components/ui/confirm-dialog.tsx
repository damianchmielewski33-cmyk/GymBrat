"use client";

import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Potwierdzenie destrukcyjnej akcji w stylu aplikacji (zamiast window.confirm).
 * Ten sam wygląd co „Zakończyć bez zapisu?” w aktywnym treningu.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Usuń",
  cancelLabel = "Anuluj",
  pending = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="app-dialog w-[min(92vw,400px)] border-white/10 p-0 text-white">
        <div className="relative overflow-hidden rounded-[var(--radius-card)] px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-90 [background:radial-gradient(520px_220px_at_50%_-20%,rgba(244,63,94,0.18),transparent_62%)]"
            aria-hidden
          />
          <div className="relative flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/12 text-rose-300">
              <Trash2 className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </div>
            <AlertDialogTitle className="mt-4 text-lg font-semibold leading-snug tracking-tight text-white">
              {title}
            </AlertDialogTitle>
            {description ? (
              <AlertDialogDescription className="mt-2 max-w-[18rem] text-[15px] leading-relaxed text-white/65">
                {description}
              </AlertDialogDescription>
            ) : null}

            <div className="mt-6 w-full space-y-2.5">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                className={cn(
                  "h-12 w-full rounded-2xl border border-rose-500/35 bg-rose-950/35 text-[15px] font-semibold text-rose-200",
                  "hover:border-rose-400/45 hover:bg-rose-950/55 hover:text-rose-100",
                )}
                onClick={() => {
                  onOpenChange(false);
                  onConfirm();
                }}
              >
                {confirmLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-2xl text-base font-semibold"
                onClick={() => onOpenChange(false)}
              >
                {cancelLabel}
              </Button>
            </div>
          </div>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
