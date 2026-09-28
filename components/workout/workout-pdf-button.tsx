"use client";

import { FileDown } from "lucide-react";

/** Otwiera widok do druku / PDF (drukuj → Zapisz jako PDF). */
export function WorkoutPdfButton({ workoutId }: { workoutId: string }) {
  return (
    <a
      href={`/workout-history/${workoutId}/print`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-white/85 transition hover:bg-white/10"
    >
      <FileDown className="h-4 w-4" aria-hidden />
      PDF / druk
    </a>
  );
}
