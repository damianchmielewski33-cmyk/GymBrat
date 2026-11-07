"use client";

import { AlertTriangle } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";
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
    <AppDialog
      open
      onOpenChange={() => {}}
      role="alertdialog"
      tone="danger"
      icon={AlertTriangle}
      title="Coś poszło nie tak"
      description={`${info.message}${info.ref ? ` Kod referencyjny: ${info.ref}.` : ""}`}
    >
      <AppDialogActions>
        <AppDialogButton intent="primary" onClick={() => window.location.reload()}>
          Odśwież stronę
        </AppDialogButton>
        <AppDialogButton onClick={() => reset()}>Spróbuj ponownie</AppDialogButton>
      </AppDialogActions>
    </AppDialog>
  );
}
