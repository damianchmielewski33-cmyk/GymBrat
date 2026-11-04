"use client";

import { useEffect } from "react";
import {
  CONSENT_CHANGED_EVENT,
  canUseAnalytics,
} from "@/lib/consent-preferences";

/**
 * Sentry w przeglądarce działa tylko po zgodzie na analitykę/monitoring (Z12):
 * bez zgody nie ładujemy SDK ani nie wysyłamy żądań; cofnięcie zgody zamyka klienta.
 */
export function SentryClientInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
    if (!dsn) return;
    let initialized = false;
    let cancelled = false;

    const sync = async () => {
      const allowed = canUseAnalytics();
      if (allowed && !initialized) {
        initialized = true;
        const Sentry = await import("@sentry/nextjs");
        if (cancelled || !canUseAnalytics()) {
          initialized = false;
          return;
        }
        const release =
          process.env.NEXT_PUBLIC_SENTRY_RELEASE?.trim() ||
          (process.env.NEXT_PUBLIC_APP_VERSION?.trim()
            ? `gymbrat@${process.env.NEXT_PUBLIC_APP_VERSION.trim()}`
            : undefined);
        Sentry.init({
          dsn,
          tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
          environment:
            process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
            process.env.NODE_ENV,
          release,
          sendDefaultPii: false,
        });
      } else if (!allowed && initialized) {
        initialized = false;
        const Sentry = await import("@sentry/nextjs");
        await Sentry.close();
      }
    };

    void sync();
    const onChange = () => void sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CONSENT_CHANGED_EVENT, onChange);
    };
  }, []);
  return null;
}
