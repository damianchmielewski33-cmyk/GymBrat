"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

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
    <AlertDialog open={open} onOpenChange={(o) => (!o ? onEnterWeight() : undefined)}>
      <AlertDialogContent className="app-dialog w-[min(92vw,400px)] border-white/10 p-5 text-white">
        <AlertDialogTitle className="text-[17px] font-semibold">
          Seria bez ciężaru?
        </AlertDialogTitle>
        <AlertDialogDescription className="mt-2 text-[13px] leading-relaxed text-white/60">
          „{exerciseName}” zwykle wykonujesz z obciążeniem, a ta seria ma 0 kg. Zapisać ją
          jako masę ciała (bez dodatkowego ciężaru w tonażu), czy wpisać ciężar?
        </AlertDialogDescription>
        <div className="mt-5 grid gap-2">
          <Button type="button" variant="cta" onClick={onBodyweight}>
            Masa ciała (0 kg)
          </Button>
          <Button type="button" variant="secondary" onClick={onEnterWeight}>
            Wpiszę ciężar
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
