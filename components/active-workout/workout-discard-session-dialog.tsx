"use client";

import { AlertTriangle } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";

/** Potwierdzenie zamknięcia sesji bez zapisu (zamiast window.confirm). */
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
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="danger"
      icon={AlertTriangle}
      /* Nad ekranem przerwy (z-1100) — inaczej X na pauzie „nic nie robi”. */
      overlayClassName="z-[1200]"
      className="z-[1201]"
      title="Zakończyć bez zapisu?"
      description="Ciężary i powtórzenia z tego treningu przepadną — nie trafią do historii ani statystyk."
    >
      <AppDialogActions>
        <AppDialogButton intent="primary" onClick={() => onOpenChange(false)}>
          Wróć do treningu
        </AppDialogButton>
        <AppDialogButton
          intent="danger"
          onClick={() => {
            onOpenChange(false);
            onConfirm();
          }}
        >
          Odrzuć trening
        </AppDialogButton>
      </AppDialogActions>
    </AppDialog>
  );
}
