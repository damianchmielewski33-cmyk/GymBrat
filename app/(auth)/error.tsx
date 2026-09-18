"use client";

import { Button } from "@/components/ui/button";
import { ScreenCard, ScreenHeading } from "@/components/layout/screen";

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ScreenCard>
      <ScreenHeading
        showBrand
        className="mb-8"
        title="Nie udało się wczytać formularza"
        description="Spróbuj ponownie za chwilę."
      />
      <Button type="button" variant="cta" className="w-full" onClick={() => reset()}>
        Spróbuj ponownie
      </Button>
    </ScreenCard>
  );
}
