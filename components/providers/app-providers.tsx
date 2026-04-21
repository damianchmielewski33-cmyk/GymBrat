"use client";

import { SessionProvider } from "next-auth/react";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { SaveFeedbackProvider } from "@/components/feedback/save-feedback";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SaveFeedbackProvider>
        <AnalyticsTracker />
        {children}
      </SaveFeedbackProvider>
    </SessionProvider>
  );
}
