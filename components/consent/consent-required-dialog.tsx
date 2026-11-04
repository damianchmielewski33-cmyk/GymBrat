"use client";

import { useState, useTransition } from "react";
import { setSensitiveConsentAction } from "@/actions/consents";
import {
  SENSITIVE_CONSENT_COPY,
  type SensitiveConsentType,
} from "@/lib/consents-client";

/**
 * Okno zgody pokazywane, gdy serwer odmówił zapisu (`code: CONSENT_REQUIRED`).
 * Po zgodzie wywołuje `onGranted` — formularz ponawia zapis.
 */
export function ConsentRequiredDialog({
  type,
  onGranted,
  onCancel,
}: {
  type: SensitiveConsentType;
  onGranted: () => void;
  onCancel: () => void;
}) {
  const copy = SENSITIVE_CONSENT_COPY[type];
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function accept() {
    setError(null);
    start(async () => {
      const res = await setSensitiveConsentAction(type, true, "body_report");
      if (res.ok) onGranted();
      else setError(res.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-required-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#0c0c0e] p-5 shadow-2xl">
        <p id="consent-required-title" className="text-[15px] font-semibold text-white">
          {copy.title}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/60">{copy.body}</p>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-red-100">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={accept}
            disabled={pending}
            className="gym-btn-primary h-11 rounded-xl text-sm font-semibold"
          >
            {copy.cta}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="gym-btn-secondary h-11 rounded-xl text-sm font-semibold"
          >
            Nie teraz
          </button>
        </div>
      </div>
    </div>
  );
}
