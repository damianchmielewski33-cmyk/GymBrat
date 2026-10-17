"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";

/**
 * Gdy baza ma pełny profil, a JWT jeszcze nie — bez soft redirectu na `/`
 * (proxy z `profileComplete !== true` odsyła z powrotem → pętla / „skaczący” ekran).
 */
export function CompleteProfileSessionBridge() {
  const { update, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (status === "loading" || started.current) return;
    started.current = true;

    void (async () => {
      try {
        await update();
        window.location.replace("/");
      } catch {
        setError(
          "Nie udało się odświeżyć sesji. Odśwież stronę albo wejdź ponownie.",
        );
      }
    })();
  }, [status, update]);

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <div className="glass-panel gold-panel relative overflow-hidden p-6 sm:p-8">
        {error ? (
          <div className="space-y-4">
            <InlineBanner role="alert" variant="error">
              {error}
            </InlineBanner>
            <Button
              type="button"
              variant="cta"
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Odśwież stronę
            </Button>
          </div>
        ) : (
          <p className="text-sm text-white/70" aria-live="polite">
            Profil jest gotowy — wchodzimy do GymBrat…
          </p>
        )}
      </div>
    </div>
  );
}
