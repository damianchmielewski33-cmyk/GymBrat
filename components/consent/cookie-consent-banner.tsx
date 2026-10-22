"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { PRIVACY_PATH } from "@/lib/legal-seller";
import {
  acceptAllConsent,
  hasConsentDecision,
  hydrateConsentToAndroidBridge,
  rejectOptionalConsent,
  writeConsentPreferences,
  defaultConsentPreferences,
  type ConsentPreferences,
} from "@/lib/consent-preferences";
import { cn } from "@/lib/utils";

export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setMounted(true);
    hydrateConsentToAndroidBridge();
    if (!hasConsentDecision()) setOpen(true);
  }, []);

  if (!mounted || !open) return null;

  function saveCustom() {
    const prefs: ConsentPreferences = defaultConsentPreferences({
      analytics,
      marketing,
    });
    writeConsentPreferences(prefs);
    setOpen(false);
  }

  const node = (
    <div
      className="fixed inset-x-0 bottom-0 z-[80] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
    >
      <div className="mx-auto max-w-lg rounded-2xl border border-white/12 bg-[#0c0c0e]/96 p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <p
          id="cookie-consent-title"
          className="text-[15px] font-semibold text-white"
        >
          Cookies i prywatność
        </p>
        <p className="mt-1.5 text-[13px] leading-snug text-white/55">
          Niezbędne dane (sesja, bezpieczeństwo) działają zawsze. Analityka i
          reklamy (AdMob) włączysz tylko za zgodą. Szczegóły w{" "}
          <Link
            href={`${PRIVACY_PATH}#cookies`}
            className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
          >
            polityce prywatności
          </Link>
          .
        </p>

        {customize ? (
          <div className="mt-3 space-y-2.5 rounded-xl border border-white/[0.08] bg-black/35 px-3 py-3">
            <label className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-white/90">
                  Analityka
                </span>
                <span className="mt-0.5 block text-[11px] text-white/40">
                  Wejścia na ekrany (page-view), statystyki produktu
                </span>
              </span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--gym-gold)]"
              />
            </label>
            <label className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-white/90">
                  Marketing / reklamy
                </span>
                <span className="mt-0.5 block text-[11px] text-white/40">
                  Pełnoekranowe reklamy AdMob przy braku pakietu
                </span>
              </span>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--gym-gold)]"
              />
            </label>
          </div>
        ) : null}

        <div
          className={cn(
            "mt-3 grid gap-2",
            customize ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3",
          )}
        >
          {customize ? (
            <>
              <button
                type="button"
                onClick={saveCustom}
                className="gym-btn-primary h-11 rounded-xl text-sm font-semibold"
              >
                Zapisz wybór
              </button>
              <button
                type="button"
                onClick={() => setCustomize(false)}
                className="gym-btn-secondary h-11 rounded-xl text-sm font-semibold"
              >
                Wróć
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  acceptAllConsent();
                  setOpen(false);
                }}
                className="gym-btn-primary h-11 rounded-xl text-sm font-semibold"
              >
                Akceptuj wszystkie
              </button>
              <button
                type="button"
                onClick={() => {
                  rejectOptionalConsent();
                  setOpen(false);
                }}
                className="gym-btn-secondary h-11 rounded-xl text-sm font-semibold"
              >
                Tylko niezbędne
              </button>
              <button
                type="button"
                onClick={() => setCustomize(true)}
                className="gym-btn-outline h-11 rounded-xl text-sm font-semibold"
              >
                Dostosuj
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
