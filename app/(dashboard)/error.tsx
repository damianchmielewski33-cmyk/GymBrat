"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScreenCard, ScreenHeading } from "@/components/layout/screen";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error]", error);
  }, [error]);

  return (
    <ScreenCard className="mx-auto max-w-lg">
      <ScreenHeading
        className="mb-8"
        title="Coś poszło nie tak"
        description="Spróbuj ponownie. Jeśli problem się powtarza, odśwież sesję lub wróć na stronę startową."
      />
      <Button type="button" variant="cta" className="w-full" onClick={() => reset()}>
        Spróbuj ponownie
      </Button>
    </ScreenCard>
  );
}
