"use client";

import { SessionProvider } from "next-auth/react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { CsrfBootstrap } from "@/components/csrf-bootstrap";
import { SaveFeedbackProvider } from "@/components/feedback/save-feedback";
import { SentryClientInit } from "@/components/sentry-client";
import { SessionAccountGuard } from "@/components/session-account-guard";
import { WorkoutOutboxFlush } from "@/components/workout/workout-outbox-flush";
import { ActiveWorkoutCloudSync } from "@/components/active-workout/active-workout-cloud-sync";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { AndroidAppUpdatePrompt } from "@/components/android-app-update-prompt";
import { PwaUpdate } from "@/components/pwa-update";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus>
      <SessionAccountGuard />
      <PwaUpdate />
      <SentryClientInit />
      <CsrfBootstrap />
      <WorkoutOutboxFlush />
      <I18nProvider>
        <ActiveWorkoutCloudSync />
        <SaveFeedbackProvider>
          <AnalyticsTracker />
          <AndroidAppUpdatePrompt />
          {children}
        </SaveFeedbackProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
