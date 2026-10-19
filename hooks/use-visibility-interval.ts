"use client";

import { useEffect, useRef } from "react";

/**
 * setInterval tylko gdy dokument jest widoczny — zero requestów w tle.
 */
export function useVisibilityInterval(
  callback: () => void,
  intervalMs: number,
  enabled: boolean,
) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const clear = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      cbRef.current();
    };

    const arm = () => {
      clear();
      if (document.visibilityState !== "visible") return;
      tick();
      timer = setInterval(tick, intervalMs);
    };

    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      clear();
      document.removeEventListener("visibilitychange", arm);
    };
  }, [enabled, intervalMs]);
}
