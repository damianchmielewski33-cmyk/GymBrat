"use client";

import { AlertTriangle } from "lucide-react";
import {
  AppDialog,
  AppDialogActions,
  AppDialogButton,
} from "@/components/ui/app-dialog";
import { useBoundaryReport } from "@/components/errors/use-boundary-report";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const info = useBoundaryReport(error, "app/global-error.tsx");

  return (
    <html lang="pl" className="dark">
      <body className="min-h-full font-sans antialiased">
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
      </body>
    </html>
  );
}
