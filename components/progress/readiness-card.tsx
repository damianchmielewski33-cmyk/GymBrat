"use client";

import Link from "next/link";
import {
  Explainer,
  Meter,
  Surface,
} from "@/components/progress/progress-ui";
import type { FatigueBand, ProgressIntelligence } from "@/lib/analytics";

const FATIGUE_BAR: Record<FatigueBand, string> = {
  fresh: "bg-[var(--gym-success)]",
  normal: "bg-[var(--gym-gold)]",
  fatigued: "bg-amber-400",
  overreached: "bg-amber-400",
};

/**
 * Gotowość: pasmo słowne + wynik /100 + meter (makieta UX 009).
 * Jeden wniosek — bez powtarzania liczby w podpowiedziach coacha.
 */
export function ReadinessCard({ data }: { data: ProgressIntelligence }) {
  const { fatigue, recovery } = data;
  const fatigueLabel =
    fatigue.band === "overreached" ? "Wysokie obciążenie" : fatigue.bandLabel;
  const fatigueAdvice =
    fatigue.band === "overreached"
      ? "Ostatnie dni były intensywne. Dziś lżejszy trening będzie dobrym wyborem."
      : fatigue.recommendation;

  return (
    <Surface className="overflow-hidden !p-0">
      <div className="space-y-0 divide-y divide-white/[0.06]">
        <div className="flex items-start gap-3 px-3.5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">Zmęczenie</p>
            <Meter
              pct={fatigue.score}
              className="mt-2.5 h-1.5"
              barClassName={FATIGUE_BAR[fatigue.band]}
            />
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-semibold text-white">{fatigueLabel}</p>
            <p className="mt-0.5 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
              {Math.round(fatigue.score)} / 100
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 px-3.5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">Regeneracja</p>
            <Meter
              pct={recovery.score}
              className="mt-2.5 h-1.5"
              barClassName="bg-[var(--gym-success)]"
            />
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[15px] font-semibold text-white">
              {recovery.bandLabel}
            </p>
            <p className="mt-0.5 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
              {Math.round(recovery.score)} / 100
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2 px-3.5 pb-3.5">
        {fatigueAdvice ? (
          <p className="rounded-2xl border border-white/12 bg-white/[0.03] px-3.5 py-3 text-[13px] leading-[18px] text-white/85">
            {fatigueAdvice}
          </p>
        ) : null}
        <p className="text-[12px] leading-4 text-[var(--gym-text-secondary)]">
          Oparte na treningach z 7 dni.{" "}
          <Link
            href="/"
            className="font-semibold text-[var(--gym-gold)] underline-offset-2 hover:underline"
          >
            Dodaj check-in
          </Link>
          , aby uwzględnić samopoczucie.
        </p>
        <Explainer label="Jak to liczymy">
          <p>
            Zmęczenie porównuje obciążenie z 7 dni do średniej z 30 dni.
            Regeneracja łączy czas od ostatniego treningu z ostatnim
            obciążeniem. To wskazówka planowania, nie diagnoza medyczna.
          </p>
        </Explainer>
      </div>
    </Surface>
  );
}
