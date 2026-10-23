"use client";

import { useEffect } from "react";
import { describeBoundaryError, reportClientError } from "@/lib/errors/client";

/**
 * Dla plików `error.tsx` / `global-error.tsx`: loguje błąd (konsola + logi serwera)
 * i zwraca zmapowany kod, komunikat dla użytkownika oraz kod referencyjny (digest).
 */
export function useBoundaryReport(
  error: Error & { digest?: string },
  scope: string,
): { code: string; message: string; ref?: string } {
  useEffect(() => {
    reportClientError(error, {
      source: "react-boundary",
      notify: false,
      context: scope,
      fallbackCode: "RENDER",
    });
  }, [error, scope]);

  return describeBoundaryError(error);
}
