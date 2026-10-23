"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProfileSwitch } from "@/components/profile/profile-ui";
import { PRIVACY_PATH } from "@/lib/legal-seller";
import {
  CONSENT_CHANGED_EVENT,
  acceptAllConsent,
  defaultConsentPreferences,
  readConsentPreferences,
  rejectOptionalConsent,
  writeConsentPreferences,
  type ConsentPreferences,
} from "@/lib/consent-preferences";

export function ConsentSettingsCard() {
  const [prefs, setPrefs] = useState<ConsentPreferences | null>(null);

  useEffect(() => {
    setPrefs(readConsentPreferences());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ConsentPreferences>).detail;
      setPrefs(detail ?? readConsentPreferences());
    };
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
  }, []);

  function patch(next: Partial<Pick<ConsentPreferences, "analytics" | "marketing">>) {
    const base = prefs ?? defaultConsentPreferences();
    const updated = defaultConsentPreferences({
      analytics: next.analytics ?? base.analytics,
      marketing: next.marketing ?? base.marketing,
    });
    writeConsentPreferences(updated);
    setPrefs(updated);
  }

  return (
    <div className="space-y-3">
      <ProfileSwitch
        checked={Boolean(prefs?.analytics)}
        onChange={(v) => patch({ analytics: v })}
        label="Analityka"
        description="Statystyki wejść i użycia aplikacji."
      />
      <ProfileSwitch
        checked={Boolean(prefs?.marketing)}
        onChange={(v) => patch({ marketing: v })}
        label="Marketing i reklamy"
        description="Reklamy pełnoekranowe, gdy nie masz aktywnego pakietu."
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => setPrefs(acceptAllConsent())}
          className="gym-btn-secondary h-10 rounded-xl px-3.5 text-[13px] font-semibold"
        >
          Akceptuj wszystkie
        </button>
        <button
          type="button"
          onClick={() => setPrefs(rejectOptionalConsent())}
          className="gym-btn-outline h-10 rounded-xl px-3.5 text-[13px] font-semibold"
        >
          Tylko niezbędne
        </button>
      </div>

      <p className="text-xs leading-relaxed text-white/40">
        Niezbędne pliki cookie (sesja, CSRF) są zawsze włączone.{" "}
        {prefs?.decidedAt
          ? `Ostatnia decyzja: ${new Date(prefs.decidedAt).toLocaleString("pl-PL")}. `
          : "Nie zapisano jeszcze wyboru — baner pojawi się przy starcie. "}
        <Link
          href={`${PRIVACY_PATH}#cookies`}
          className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
        >
          Polityka prywatności
        </Link>
      </p>
    </div>
  );
}
