"use client";

import { useEffect, useRef } from "react";

/**
 * Gdy pełnoekranowy overlay jest otwarty, dokłada wpis do historii przeglądarki /
 * WebView. Systemowy wstecz zamyka overlay zamiast wychodzić z trasy (np. Dieta → Pulpit).
 */
export function useOverlayHistoryBack(
  open: boolean,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !open) return;

    window.history.pushState({ gymbratOverlay: true }, "");
    pushedRef.current = true;

    const onPopState = () => {
      if (!pushedRef.current) return;
      pushedRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (pushedRef.current) {
        // Zamknięcie z UI — zdejmij wpis historii bez ponownego onClose.
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [open]);
}
