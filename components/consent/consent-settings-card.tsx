"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  saveConsentAction,
  saveConsentsBulkAction,
} from "@/actions/consents";
import {
  ProfileSwitch,
  ProfileSystemState,
} from "@/components/profile/profile-ui";
import { PRIVACY_PATH } from "@/lib/legal-seller";
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

  function bulk(analytics: boolean, marketing: boolean) {
    const updated = persistLocal({ analytics, marketing });
    start(async () => {
      await saveConsentsBulkAction({
        analytics: updated.analytics,
        marketing: updated.marketing,
        source: "profile",
      });
    });
  }

  const decidedAt = prefs?.decidedAt ?? initial?.decidedAt ?? null;

  return (
    <div className={`space-y-3 ${pending ? "opacity-80" : ""}`}>
      <ProfileSwitch
        checked={Boolean(prefs?.analytics)}
        onChange={(v) => patch({ analytics: v })}
        label="Analityka"
        description="Statystyki wejść i użycia aplikacji."
        disabled={pending}
      />
      <ProfileSwitch
        checked={Boolean(prefs?.marketing)}
        onChange={(v) => patch({ marketing: v })}
        label="Marketing i reklamy"
        description="Reklamy pełnoekranowe, gdy nie masz aktywnego pakietu."
        disabled={pending}
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => bulk(true, true)}
          className="gym-btn-secondary h-10 rounded-xl px-3.5 text-[13px] font-semibold"
        >
          Akceptuj wszystkie
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => bulk(false, false)}
          className="gym-btn-outline h-10 rounded-xl px-3.5 text-[13px] font-semibold"
        >
          Tylko niezbędne
        </button>
      </div>

      {decidedAt ? (
        <ProfileSystemState
          label="Ostatnia decyzja"
          value={new Date(decidedAt).toLocaleString("pl-PL")}
        />
      ) : (
        <p className="text-xs leading-relaxed text-white/40">
          Nie zapisano jeszcze wyboru — baner pojawi się przy starcie.
        </p>
      )}

      <p className="text-xs leading-relaxed text-white/40">
        Niezbędne pliki cookie (sesja, CSRF) są zawsze włączone.{" "}
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
