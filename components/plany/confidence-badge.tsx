import { Check, CircleAlert, TriangleAlert } from "lucide-react";
import type { ImportConfidence } from "@/lib/workout-plan/import-parse";
import { cn } from "@/lib/utils";

export type ConfidenceDisplay =
  | ImportConfidence
  | "corrected";

const LABELS: Record<ConfidenceDisplay, string> = {
  high: "Wysoka pewność",
  name_check: "Sprawdź nazwę",
  low: "Sprawdź wiersz",
  corrected: "Poprawione ręcznie",
};

export function ConfidenceBadge({
  level,
}: {
  level: ConfidenceDisplay;
}) {
  const label = LABELS[level];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold",
        level === "high" &&
          "border-[rgba(62,207,114,0.5)] text-white",
        level === "name_check" &&
          "border-[rgba(235,196,74,0.55)] text-[var(--gym-gold)]",
        level === "low" &&
          "border-[rgba(255,51,71,0.55)] text-[#ffd0d5]",
        level === "corrected" &&
          "border-white/20 text-[var(--gym-text-secondary)]",
      )}
      aria-label={`Pewność odczytu: ${label.toLowerCase()}`}
    >
      {level === "high" ? (
        <Check className="h-3 w-3" aria-hidden />
      ) : level === "name_check" ? (
        <TriangleAlert className="h-3 w-3" aria-hidden />
      ) : level === "low" ? (
        <CircleAlert className="h-3 w-3" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

export function needsImportReview(
  confidence: ImportConfidence,
  reviewed: boolean,
): boolean {
  if (reviewed) return false;
  return confidence === "low" || confidence === "name_check";
}
