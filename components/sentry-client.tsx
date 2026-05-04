"use client";

import { useEffect } from "react";

export function SentryClientInit() {
  useEffect(() => {
    void (async () => {
      const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
      if (!dsn) return;
      const Sentry = await import("@sentry/nextjs");
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
    })();
  }, []);
  return null;
}
