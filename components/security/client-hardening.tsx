"use client";

import { useLayoutEffect } from "react";
import { applyClientHardening } from "@/lib/client-hardening";

/** Wczesne utwardzenie klienta (konsola + React DevTools) — tylko produkcja. */
export function ClientHardening() {
  useLayoutEffect(() => {
    applyClientHardening();
  }, []);

  return null;
}
