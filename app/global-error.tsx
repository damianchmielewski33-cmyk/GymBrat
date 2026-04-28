"use client";

import { useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error.tsx]", error);
  }, [error]);

  return (
    <html lang="pl" className="dark">
      <body className="min-h-full font-sans antialiased">
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
              <Button onClick={() => window.location.reload()}>
                Odśwież stronę
              </Button>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </body>
    </html>
  );
}

