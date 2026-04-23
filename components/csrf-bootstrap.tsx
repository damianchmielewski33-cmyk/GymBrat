"use client";

import { useEffect } from "react";

/** Ustawia cookie CSRF przy starcie aplikacji (credentials). */
export function CsrfBootstrap() {
  useEffect(() => {
    void fetch("/api/csrf", { credentials: "include" }).catch(() => {});
  }, []);
  return null;
}
