"use client";

import { useEffect } from "react";

/** Po załadowaniu otwiera dialog druku (PDF). */
export function PrintAutoTrigger() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      window.print();
    }, 400);
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
