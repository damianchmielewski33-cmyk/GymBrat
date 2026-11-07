"use client";

import { Dumbbell } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";

/**
 * US13 / Z62: zapis serii 0 kg przy ćwiczeniu z obciążeniem wymaga świadomego wyboru —
 * „masa ciała” (zapisujemy 0 kg, bez tonażu zewnętrznego) albo wpisanie ciężaru.
 */
export function BodyweightConfirmDialog({
  open,
  exerciseName,
  onBodyweight,
  onEnterWeight,
}: {
  open: boolean;
  exerciseName: string;
  onBodyweight: () => void;
  onEnterWeight: () => void;
}) {
  return (
    <AppDialog
      open={open}
      onOpenChange={(o) => (!o ? onEnterWeight() : undefined)}
      tone="gold"
      icon={Dumbbell}
      title="Seria bez ciężaru?"
      description={`„${exerciseName}” zwykle robisz z obciążeniem, a ta seria ma 0 kg. Jako masa ciała nie doda nic do tonażu. Wolisz wpisać ciężar?`}
    >
      <AppDialogActions>
        <AppDialogButton intent="primary" onClick={onBodyweight}>
          Zapisz jako masę ciała
        </AppDialogButton>
        <AppDialogButton onClick={onEnterWeight}>Wpiszę ciężar</AppDialogButton>
      </AppDialogActions>
    </AppDialog>
  );
}
