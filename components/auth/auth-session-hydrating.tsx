"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";

const RETRY_KEY = "gymbrat.auth.hydrate-retries";
const MAX_RETRIES = 2;

/**
 * Ciasteczko sesji jest, ale `auth()` jeszcze nie zwróciło usera (częste zaraz po
 * powrocie z Google na iOS). Unikamy redirectu na /login — proxy z tokenem
 * odsyła z powrotem na /complete-profile i ekran „skacze”.
 */
export function AuthSessionHydrating({
  fallbackHref = "/login?callbackUrl=/complete-profile",
}: {
  fallbackHref?: string;
}) {
  const [giveUp, setGiveUp] = useState(false);

  useEffect(() => {
    let retries = 0;
    try {
      retries = Number(sessionStorage.getItem(RETRY_KEY) ?? "0") || 0;
    } catch {
      /* private mode */
    }

    if (retries >= MAX_RETRIES) {
      setGiveUp(true);
      try {
        sessionStorage.removeItem(RETRY_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      sessionStorage.setItem(RETRY_KEY, String(retries + 1));
    } catch {
      /* ignore */
    }

    const t = window.setTimeout(() => {
      window.location.reload();
    }, 450);
    return () => window.clearTimeout(t);
  }, []);

  if (giveUp) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 pb-10">
        <div className="glass-panel gold-panel p-6 sm:p-8 space-y-4">
          <InlineBanner role="alert" variant="error">
            Sesja po Google nie dograła się na tym urządzeniu. Zaloguj się ponownie.
          </InlineBanner>
          <Button
            type="button"
            variant="cta"
            className="w-full"
            onClick={() => {
              window.location.assign(fallbackHref);
            }}
          >
            Wróć do logowania
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg pb-10">
      <div className="glass-panel gold-panel p-6 sm:p-8">
        <p className="text-sm text-white/70" aria-live="polite">
          Kończymy logowanie Google…
        </p>
      </div>
    </div>
  );
}
