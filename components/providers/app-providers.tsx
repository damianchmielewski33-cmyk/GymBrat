"use client";

import { SessionProvider } from "next-auth/react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { CsrfBootstrap } from "@/components/csrf-bootstrap";
import { SaveFeedbackProvider } from "@/components/feedback/save-feedback";
import { SentryClientInit } from "@/components/sentry-client";
import { GlobalErrorPopupManager } from "@/components/system/global-error-popup-manager";
import { WorkoutOutboxFlush } from "@/components/workout/workout-outbox-flush";
import { I18nProvider } from "@/components/i18n/i18n-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SentryClientInit />
      <GlobalErrorPopupManager />
      <CsrfBootstrap />
      <WorkoutOutboxFlush />
      <I18nProvider>
        <SaveFeedbackProvider>
          <AnalyticsTracker />
          {children}
        </SaveFeedbackProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
