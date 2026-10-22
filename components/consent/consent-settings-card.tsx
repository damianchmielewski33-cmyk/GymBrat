"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";

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
    <div className="space-y-4">
      <p className="text-[13px] leading-snug text-white/50">
        Niezbędne cookies (sesja, CSRF) są zawsze włączone. Opcjonalne kategorie
        możesz zmienić w każdej chwili.{" "}
        <Link
          href={`${PRIVACY_PATH}#cookies`}
          className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
        >
          Polityka prywatności
        </Link>
      </p>

      <div className="space-y-2.5 rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-3">
        <label className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-white/90">
              Analityka
            </span>
            <span className="mt-0.5 block text-[11px] text-white/40">
              Statystyki wejść i użycia aplikacji
            </span>
          </span>
          <input
            type="checkbox"
            checked={Boolean(prefs?.analytics)}
            onChange={(e) => patch({ analytics: e.target.checked })}
            className="mt-1 h-4 w-4 accent-[var(--gym-gold)]"
          />
        </label>
        <label className="flex items-start justify-between gap-3 border-t border-white/[0.06] pt-2.5">
          <span className="min-w-0">
            <span className="block text-[13px] font-semibold text-white/90">
              Marketing / reklamy
            </span>
            <span className="mt-0.5 block text-[11px] text-white/40">
              AdMob interstitial przy braku pakietu
            </span>
          </span>
          <input
            type="checkbox"
            checked={Boolean(prefs?.marketing)}
            onChange={(e) => patch({ marketing: e.target.checked })}
            className="mt-1 h-4 w-4 accent-[var(--gym-gold)]"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPrefs(acceptAllConsent())}
          className={cn("gym-btn-secondary h-10 rounded-xl px-3 text-[12px] font-semibold")}
        >
          Akceptuj wszystkie
        </button>
        <button
          type="button"
          onClick={() => setPrefs(rejectOptionalConsent())}
          className={cn("gym-btn-outline h-10 rounded-xl px-3 text-[12px] font-semibold")}
        >
          Tylko niezbędne
        </button>
      </div>

      {prefs?.decidedAt ? (
        <p className="text-[11px] text-white/35">
          Ostatnia decyzja:{" "}
          {new Date(prefs.decidedAt).toLocaleString("pl-PL")}
        </p>
      ) : (
        <p className="text-[11px] text-amber-200/80">
          Nie zapisano jeszcze wyboru — banner cookies pojawi się przy starcie.
        </p>
      )}
    </div>
  );
}
