"use client";

import { useEffect } from "react";

export function SentryClientInit() {
  useEffect(() => {
    void (async () => {
      const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
      if (!dsn) return;
      const Sentry = await import("@sentry/nextjs");
      Sentry.init({
        dsn,
        tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
      });
    })();
  }, []);
  return null;
}
