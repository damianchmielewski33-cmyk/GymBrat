"use client";

import { useEffect } from "react";
import { isInstalledAndroidAppClient } from "@/lib/app-webview";

/**
 * W APK Android fokus na polach logowania potrafi „skakać” zoomem viewportu.
 * Blokujemy skalowanie tylko w WebView aplikacji — przeglądarka zostaje bez zmian.
 */
export function WebViewViewportLock() {
  useEffect(() => {
    if (!isInstalledAndroidAppClient()) return;

    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;

    const previous = meta.getAttribute("content");
    meta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
    );

    return () => {
      if (previous != null) meta.setAttribute("content", previous);
    };
  }, []);

  return null;
}
