"use client";

import { useEffect } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  installClientErrorHandling,
  setClientErrorNotifier,
} from "@/lib/errors/client";

/**
 * Włącza globalną obsługę błędów w przeglądarce (fetch → /api, window.onerror,
 * unhandledrejection, ślad ostatniego kliknięcia) i podpina popup z komunikatem.
 * Renderuj wewnątrz `SaveFeedbackProvider`.
 */
export function GlobalErrorHandlers() {
  const { notifyError } = useSaveFeedback();

  useEffect(() => {
    setClientErrorNotifier(notifyError);
    const uninstall = installClientErrorHandling();
    return () => {
      uninstall();
      setClientErrorNotifier(null);
    };
  }, [notifyError]);

  return null;
}
