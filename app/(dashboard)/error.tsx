"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="mx-auto max-w-lg space-y-6 rounded-2xl border border-red-500/35 bg-red-950/35 p-8 text-center">
      <h2 className="font-heading text-xl font-semibold text-white">Coś poszło nie tak</h2>
      <p className="text-sm text-white/65">
        Spróbuj ponownie. Jeśli problem się powtarza, odśwież sesję lub wróć na stronę startową.
      </p>
      <Button type="button" onClick={() => reset()} className="mx-auto">
        Spróbuj ponownie
      </Button>
    </div>
  );
}
