"use client";

import { Button } from "@/components/ui/button";
import { ScreenCard, ScreenHeading } from "@/components/layout/screen";
import { useBoundaryReport } from "@/components/errors/use-boundary-report";

/** Z61: błąd Analizy z możliwością ponowienia, bez utraty ramy aplikacji. */
export default function ProgressError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const info = useBoundaryReport(error, "app/(dashboard)/progress/error.tsx");
  return (
    <ScreenCard className="mx-auto max-w-lg">
      <ScreenHeading
        className="mb-8"
        title="Nie udało się wczytać analizy"
        description={`${info.message}${info.ref ? ` Kod referencyjny: ${info.ref}.` : ""}`}
      />
      <Button type="button" variant="cta" className="w-full" onClick={() => reset()}>
        Spróbuj ponownie
      </Button>
    </ScreenCard>
  );
}
