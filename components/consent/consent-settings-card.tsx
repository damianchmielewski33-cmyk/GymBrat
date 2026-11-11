"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  saveConsentAction,
} from "@/actions/consents";
import {
  ProfileSwitch,
  ProfileSystemState,
} from "@/components/profile/profile-ui";
import { PRIVACY_PATH } from "@/lib/legal-seller";
import { openConsentSettings } from "@/lib/consent-preferences";
import {
  CONSENT_CHANGED_EVENT,
  defaultConsentPreferences,
  readConsentPreferences,
  writeConsentPreferences,
  type ConsentPreferences,
} from "@/lib/consent-preferences";
import { CURRENT_CONSENT_TEXT_VERSION } from "@/lib/consents-client";

export type ConsentSettingsInitial = {
  analytics: boolean | null;
  marketing: boolean | null;
  decidedAt: string | null;
};

export function ConsentSettingsCard({
  initial,
}: {
  initial?: ConsentSettingsInitial;
}) {
  const [prefs, setPrefs] = useState<ConsentPreferences | null>(() => {
    if (initial && (initial.analytics != null || initial.marketing != null)) {
      return defaultConsentPreferences({
        analytics: Boolean(initial.analytics),
        marketing: Boolean(initial.marketing),
      });
    }
    return null;
  });
  const [pending, start] = useTransition();

  useEffect(() => {
    if (prefs) {
      writeConsentPreferences(prefs);
      return;
    }
    const local = readConsentPreferences();
    if (local) setPrefs(local);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- hydrate once

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ConsentPreferences>).detail;
      setPrefs(detail ?? readConsentPreferences());
    };
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
  }, []);

  function persistLocal(
    next: Partial<Pick<ConsentPreferences, "analytics" | "marketing">>,
  ) {
    const base = prefs ?? defaultConsentPreferences();
    const updated = defaultConsentPreferences({
      analytics: next.analytics ?? base.analytics,
      marketing: next.marketing ?? base.marketing,
    });
    writeConsentPreferences(updated);
    setPrefs(updated);
    return updated;
  }

  function patch(
    next: Partial<Pick<ConsentPreferences, "analytics" | "marketing">>,
  ) {
    const updated = persistLocal(next);
    start(async () => {
      if (next.analytics != null) {
        const fd = new FormData();
        fd.set("granted", updated.analytics ? "1" : "0");
        fd.set("source", "profile");
        fd.set("textVersion", CURRENT_CONSENT_TEXT_VERSION);
        await saveConsentAction("analytics", null, fd);
      }
      if (next.marketing != null) {
        const fd = new FormData();
        fd.set("granted", updated.marketing ? "1" : "0");
        fd.set("source", "profile");
        fd.set("textVersion", CURRENT_CONSENT_TEXT_VERSION);
        await saveConsentAction("marketing", null, fd);
      }
    });
  }

  const decidedAt = prefs?.decidedAt ?? initial?.decidedAt ?? null;

  return (
    <div className={`space-y-3 ${pending ? "opacity-80" : ""}`}>
      <div className="divide-y divide-white/[0.07]">
      <ProfileSwitch
        checked={Boolean(prefs?.analytics)}
        onChange={(v) => patch({ analytics: v })}
        label="Analityka"
        description="Statystyki wejść i użycia aplikacji."
        disabled={pending}
      />
      </div>

      <button
        type="button"
        onClick={openConsentSettings}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-white">
            Ustawienia reklam i cookies
          </span>
          <span className="block text-[13px] leading-snug text-white/55">
            Reklamy są częścią wersji bezpłatnej. Tu zmienisz zgodę na ich
            personalizację i na analitykę.
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/55" aria-hidden />
      </button>

      {decidedAt ? (
        <ProfileSystemState
          label="Ostatnia decyzja"
          value={new Date(decidedAt).toLocaleString("pl-PL")}
        />
      ) : (
        <p className="text-xs leading-relaxed text-white/50">
          Nie zapisano jeszcze wyboru — baner pojawi się przy starcie.
        </p>
      )}

      <p className="text-xs leading-relaxed text-white/50">
        Niezbędne pliki cookie (sesja, CSRF) są zawsze włączone. Reklamy są
        częścią bezpłatnej wersji aplikacji (usuwa je pakiet).{" "}
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
