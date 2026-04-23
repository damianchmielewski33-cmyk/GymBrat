"use client";

import { Button } from "@/components/ui/button";

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-red-500/35 bg-red-950/35 p-6 text-center">
      <p className="text-sm text-white/75">Nie udało się wczytać formularza.</p>
      <Button type="button" onClick={() => reset()} variant="secondary">
        Spróbuj ponownie
      </Button>
    </div>
  );
}
