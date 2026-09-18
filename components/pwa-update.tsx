"use client";

import { useEffect } from "react";
import {
  SW_CLEARED_SESSION_KEY,
  clearStaleServiceWorkers,
  shouldReloadAfterServiceWorkerClear,
} from "@/lib/pwa-update";

/** Drops leftover next-pwa workers so production deploys are visible immediately. */
export function PwaUpdate() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    void (async () => {
      const hadController = Boolean(navigator.serviceWorker.controller);
      const result = await clearStaleServiceWorkers({
        getRegistrations: () => navigator.serviceWorker.getRegistrations(),
        caches: "caches" in globalThis ? caches : undefined,
      });

      const alreadyReloaded = sessionStorage.getItem(SW_CLEARED_SESSION_KEY) === "1";
      if (
        !shouldReloadAfterServiceWorkerClear({
          hadController,
          registrationCount: result.registrationCount,
          cacheCount: result.cacheCount,
          alreadyReloaded,
        })
      ) {
        return;
      }

      sessionStorage.setItem(SW_CLEARED_SESSION_KEY, "1");
      window.location.reload();
    })();
  }, []);

  return null;
}
