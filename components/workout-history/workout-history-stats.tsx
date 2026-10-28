"use client";

import { Info } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import type { WorkoutHistoryKpis } from "@/lib/workout-history-overview";
import { cn } from "@/lib/utils";

type Props = {
  kpis: WorkoutHistoryKpis;
  scopeLabel: string;
  sessionsLimitReached: boolean;
  empty: boolean;
  liveAnnouncement: string;
};

export function WorkoutHistoryStats({
  kpis,
  scopeLabel,
  sessionsLimitReached,
  empty,
  liveAnnouncement,
}: Props) {
  const tonnageTonnes = Math.max(0, kpis.tonnageTotalKg) / 1000;
  const tonnageCaption = sessionsLimitReached
    ? "z 400 ostatnich"
    : "cała historia";
  const durationCaption = empty
    ? "brak treningów"
    : `z ${kpis.workoutsTotal} ${
        kpis.workoutsTotal === 1
          ? "treningu"
          : kpis.workoutsTotal >= 2 && kpis.workoutsTotal <= 4
            ? "treningów"
            : "treningów"
      }`;

  return (
    <section aria-labelledby="history-summary-heading">
      <SectionLabel
        title="Podsumowanie"
        titleAs="h2"
        titleTone="white"
        trailing={
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[12px]",
              scopeLabel === "Wszystkie treningi"
                ? "border-white/15 text-[var(--gym-text-secondary)]"
                : "border-[rgba(235,196,74,0.45)] text-[var(--gym-gold)]",
            )}
          >
            {scopeLabel}
          </span>
        }
      />
      <span id="history-summary-heading" className="sr-only">
        Podsumowanie
      </span>

      <div
        className="app-card mt-2.5 grid grid-cols-3 gap-2 px-3 py-4"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="sr-only">{liveAnnouncement}</span>

        <div className="min-w-0 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
            Na tydzień
          </p>
          <p
            className="mt-1.5 font-metric text-[1.5rem] leading-none text-white sm:text-[1.7rem]"
            aria-label={`Na tydzień: ${empty ? "brak danych" : kpis.avgWorkoutsPerWeekLast8}`}
          >
            {empty ? (
              <span className="text-[var(--gym-text-secondary)]">—</span>
            ) : (
              <AnimatedMetric value={kpis.avgWorkoutsPerWeekLast8} decimals={1} />
            )}
          </p>
          <p className="mt-1.5 text-[11px] leading-tight text-[var(--gym-text-secondary)]">
            {empty ? "brak treningów" : "średnio z 8 tyg."}
          </p>
        </div>

        <div className="min-w-0 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
            Średni czas
          </p>
          <p
            className="mt-1.5 font-metric text-[1.5rem] leading-none text-white sm:text-[1.7rem]"
            aria-label={
              empty || kpis.avgDurationMinutes == null
                ? "Średni czas: brak danych"
                : `Średni czas: ${kpis.avgDurationMinutes} minut`
            }
          >
            {empty || kpis.avgDurationMinutes == null ? (
              <span className="text-[var(--gym-text-secondary)]">—</span>
            ) : (
              <>
                <AnimatedMetric value={kpis.avgDurationMinutes} />
                <span className="ml-1 font-metric text-sm text-[var(--gym-text-secondary)]">
                  min
                </span>
              </>
            )}
          </p>
          <p className="mt-1.5 text-[11px] leading-tight text-[var(--gym-text-secondary)]">
            {durationCaption}
          </p>
        </div>

        <div className="min-w-0 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
            Tonaż
          </p>
          <p
            className="mt-1.5 font-metric text-[1.5rem] leading-none text-white sm:text-[1.7rem]"
            aria-label={
              empty
                ? "Tonaż: brak danych"
                : `Tonaż: ${tonnageTonnes.toFixed(1).replace(".", ",")} tony`
            }
          >
            {empty ? (
              <span className="text-[var(--gym-text-secondary)]">—</span>
            ) : (
              <>
                <AnimatedMetric value={tonnageTonnes} decimals={1} />
                <span className="ml-1 font-metric text-sm text-[var(--gym-text-secondary)]">
                  t
                </span>
              </>
            )}
          </p>
          <p
            className="mt-1.5 inline-flex items-center justify-center gap-1 text-[11px] leading-tight text-[var(--gym-text-secondary)]"
            aria-describedby={
              sessionsLimitReached ? "history-tonnage-limit" : undefined
            }
          >
            {empty ? "brak treningów" : tonnageCaption}
            {sessionsLimitReached && !empty ? (
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : null}
          </p>
        </div>
      </div>
    </section>
  );
}
