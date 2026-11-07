"use client";

/**
 * Dialog „Zakończyć trening?”: jedno dodatkowe potwierdzenie przed `requestFinish()`,
 * pokazywane z paska globalnego i menu sesji, gdy nie ma pominiętych/niewykonanych serii.
 */
import { useRef } from "react";
import { CircleCheck } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";

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
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      role="alertdialog"
      tone="gold"
      icon={CircleCheck}
      initialFocus={safeButtonRef}
      title="Zakończyć trening?"
      description="Zapiszemy serie, tonaż i czas treningu, a potem pokażemy podsumowanie."
    >
      <AppDialogActions>
        <AppDialogButton
          intent="primary"
          disabled={busy}
          onClick={() => {
            onOpenChange(false);
            onConfirm();
          }}
        >
          {busy ? "Zapisuję…" : "Zakończ i zapisz"}
        </AppDialogButton>
        <AppDialogButton ref={safeButtonRef} disabled={busy} onClick={() => onOpenChange(false)}>
          Wróć do treningu
        </AppDialogButton>
      </AppDialogActions>
    </AppDialog>
  );
}
