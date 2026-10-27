"use client";

import { Meter, Surface } from "@/components/progress/progress-ui";
import type { FatigueBand, ProgressIntelligence } from "@/lib/analytics";

const FATIGUE_BAR: Record<FatigueBand, string> = {
  fresh: "bg-emerald-400",
  normal: "bg-[var(--gym-gold)]",
  fatigued: "bg-amber-400",
  overreached: "bg-amber-400",
};

/**
 * Gotowość do treningu: zmęczenie + regeneracja + 3 najważniejsze wskazówki.
 * Wcześniej ten pasek był doklejany nad KAŻDĄ zakładką (także Sylwetką i Zdjęciami).
 */
export function ReadinessCard({ data }: { data: ProgressIntelligence }) {
  const { fatigue, recovery } = data;
  const fatigueLabel = fatigue.band === "overreached" ? "Wysokie obciążenie" : fatigue.bandLabel;
  const fatigueAdvice = fatigue.band === "overreached"
    ? "Ostatnie dni były intensywne. Lżejszy dzień dobrze zrobi."
    : fatigue.recommendation;

  return (
    <Surface variant="hero" className="space-y-3">
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-white">Zmęczenie</p>
            <p className="text-[15px] font-semibold text-white">{fatigueLabel}</p>
          </div>
          <Meter
            pct={fatigue.score}
            className="mt-2 h-1.5"
            barClassName={FATIGUE_BAR[fatigue.band]}
          />
          <p className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">Wynik na podstawie treningów z ostatnich 7 dni.</p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-white">Regeneracja</p>
            <p className="text-[15px] font-semibold text-white">{recovery.bandLabel}</p>
          </div>
          <Meter
            pct={recovery.score}
            className="mt-2 h-1.5"
            barClassName="bg-emerald-400"
          />
          <p className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">Odpoczynek od treningów i ostatnie obciążenie.</p>
        </div>
      </div>

      <div className="border-t border-white/10 pt-2.5">
        <p className="text-[13px] leading-snug text-white/85">{fatigueAdvice}</p>
        <p className="mt-2 text-[12px] text-[var(--gym-text-secondary)]">Oparte na treningach z 7 dni. Dodaj check-in, aby uwzględnić samopoczucie.</p>
      </div>
    </Surface>
  );
}
