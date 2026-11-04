"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { saveConsentsBulkAction } from "@/actions/consents";
import {
  CONSENT_CHANGED_EVENT,
  readConsentPreferences,
} from "@/lib/consent-preferences";

const SYNCED_PREFIX = "gymbrat_consent_synced:";

/**
 * Wybór z banera (localStorage) trafia do rejestru zgód zalogowanego użytkownika (Z11/Z12),
 * także gdy wybór zapadł przed logowaniem. Serwer pomija wpisy bez zmiany, więc wywołanie jest
 * bezpieczne wielokrotnie; znacznik w sessionStorage ogranicza je do raz na decyzję i kartę.
 */
export function ConsentSessionSync() {
  const { data } = useSession();
  const userId = data?.user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const sync = async (fromUserChoice: boolean) => {
      const prefs = readConsentPreferences();
      if (!prefs) return;
      const key = `${SYNCED_PREFIX}${userId}`;
      try {
        if (sessionStorage.getItem(key) === prefs.decidedAt) return;
      } catch {
        /* brak sessionStorage — serwer i tak deduplikuje */
      }
      const res = await saveConsentsBulkAction({
        analytics: prefs.analytics,
        marketing: prefs.marketing,
        source: "banner",
        // Przy starcie sesji stary wybór z przeglądarki uzupełnia tylko brakujące decyzje;
        // świeży wybór użytkownika (zdarzenie) zawsze obowiązuje.
        onlyIfUndecided: !fromUserChoice,
      });
      if (!cancelled && res.ok) {
        try {
          sessionStorage.setItem(key, prefs.decidedAt);
        } catch {
          /* ignore */
        }
      }
    };

    void sync(false);
    const onChange = () => void sync(true);
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
    };
  }, [userId]);

  return null;
}
