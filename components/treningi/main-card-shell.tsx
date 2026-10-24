import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Kicker karty głównej („Następny · Dzień 3”, „Niedokończony trening”, „Plan treningowy”). */
export const mainCardKickerClass =
  "text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]";

/** Tytuł karty głównej (h2); na niskich ekranach 1 linia (budżet „above the fold”). */
export const mainCardTitleClass =
  "mt-1.5 line-clamp-2 font-heading text-[22px] font-semibold leading-tight text-white outline-none [overflow-wrap:anywhere] compact:line-clamp-1";

/**
 * Wspólna rama czterech wariantów karty głównej ekranu Trening (jeden slot, BR-11).
 * `accent` = mocniejsze obramowanie niedokończonego treningu.
 */
export function MainCardShell({
  accent = false,
  minHeightClass,
  titleId,
  children,
}: {
  accent?: boolean;
  /** Minimalna wysokość (np. by podmiana wariantu nie przesuwała układu). */
  minHeightClass?: string;
  titleId: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "app-card relative overflow-hidden p-4 compact:p-3.5",
        minHeightClass,
        accent &&
          "border-[var(--gym-gold)]/35 shadow-[0_0_40px_color-mix(in_srgb,var(--gym-gold)_12%,transparent)]",
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 [background:linear-gradient(165deg,color-mix(in_srgb,var(--gym-gold)_16%,transparent)_0%,transparent_58%)]"
        aria-hidden
      />
      <div className="relative">{children}</div>
    </section>
  );
}
