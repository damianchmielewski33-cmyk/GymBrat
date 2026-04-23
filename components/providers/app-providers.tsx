"use client";

import { SessionProvider } from "next-auth/react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { CsrfBootstrap } from "@/components/csrf-bootstrap";
import { SaveFeedbackProvider } from "@/components/feedback/save-feedback";
import { SentryClientInit } from "@/components/sentry-client";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SentryClientInit />
      <CsrfBootstrap />
      <SaveFeedbackProvider>
        <AnalyticsTracker />
        {children}
      </SaveFeedbackProvider>
    </SessionProvider>
  );
}
