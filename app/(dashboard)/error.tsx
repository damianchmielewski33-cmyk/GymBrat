"use client";

import { Button } from "@/components/ui/button";
import { ScreenCard, ScreenHeading } from "@/components/layout/screen";
import { useBoundaryReport } from "@/components/errors/use-boundary-report";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const info = useBoundaryReport(error, "app/(dashboard)/error.tsx");

  return (
    <ScreenCard className="mx-auto max-w-lg">
      <ScreenHeading
        className="mb-8"
        title="Coś poszło nie tak"
        description={`${info.message}${info.ref ? ` Kod referencyjny: ${info.ref}.` : ""}`}
      />
      <Button type="button" variant="cta" className="w-full" onClick={() => reset()}>
        Spróbuj ponownie
      </Button>
    </ScreenCard>
  );
}
