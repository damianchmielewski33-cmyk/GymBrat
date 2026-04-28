"use client";

import { useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Wymóg: gdy „poleci błąd” pokaż pop-up.
  // Next i tak wyrenderuje ten komponent tylko w sytuacji błędu.
  useEffect(() => {
    console.error("[app/error.tsx]", error);
  }, [error]);

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogTitle>Zmieniamy się na lepsze</AlertDialogTitle>
        <AlertDialogDescription>
          Zmieniamy się na lepsze
        </AlertDialogDescription>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={() => reset()}>
            Spróbuj ponownie
          </Button>
          <Button onClick={() => window.location.reload()}>Odśwież stronę</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

