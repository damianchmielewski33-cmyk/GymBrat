"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useBoundaryReport } from "@/components/errors/use-boundary-report";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const info = useBoundaryReport(error, "app/error.tsx");

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogTitle>Coś poszło nie tak</AlertDialogTitle>
        <AlertDialogDescription>
          {info.message}
          {info.ref ? ` Kod referencyjny: ${info.ref}.` : ""}
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
