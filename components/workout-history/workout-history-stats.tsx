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
  /** Tonaż (kg) kolejnych tygodni, od najstarszego do bieżącego (max 8). */
  weekBars?: number[];
};

const TILE = "min-w-0 rounded-2xl border px-3 py-2.5";

export function WorkoutHistoryStats({
  kpis,
  scopeLabel,
  sessionsLimitReached,
  empty,
  liveAnnouncement,
  weekBars = [],
}: Props) {
  const tonnageTonnes = Math.max(0, kpis.tonnageTotalKg) / 1000;
  const tonnageCaption = sessionsLimitReached
    ? "z 400 ostatnich"
    : "cała historia";
  const durationCaption = empty
    ? "brak treningów"
    : `z ${kpis.workoutsTotal} ${
        kpis.workoutsTotal === 1 ? "treningu" : "treningów"
      }`;
  const barMax = Math.max(1, ...weekBars);

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
                : "border-[rgba(var(--neon-rgb),0.45)] text-[var(--gym-gold)]",
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
        className="app-card mt-2.5 p-3.5"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="sr-only">{liveAnnouncement}</span>

        <div className="grid grid-cols-[1.25fr_1fr_1fr] gap-2">
          <div
            className={cn(
              TILE,
              "border-[var(--gym-gold)]/25 bg-[rgba(var(--neon-rgb),0.08)]",
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-text-secondary)]">
              Tonaż
            </p>
            <p
              className="mt-1 flex items-baseline gap-1 font-display text-[34px] leading-none text-[var(--gym-gold-bright)] [text-shadow:0_0_16px_rgba(246,227,161,0.3)]"
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
                  <span className="font-heading text-[12px] text-[var(--gym-gold)]">
                    t
                  </span>
                </>
              )}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] leading-tight text-[var(--gym-text-secondary)]">
              {empty ? "brak treningów" : tonnageCaption}
              {sessionsLimitReached && !empty ? (
                <Info className="h-3 w-3 shrink-0" aria-hidden />
              ) : null}
            </p>
          </div>

          <div className={cn(TILE, "border-white/[0.08] bg-black/30")}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-text-secondary)]">
              Na tydzień
            </p>
            <p
              className="mt-1 font-display text-[34px] leading-none text-white"
              aria-label={`Na tydzień: ${empty ? "brak danych" : kpis.avgWorkoutsPerWeekLast8}`}
            >
              {empty ? (
                <span className="text-[var(--gym-text-secondary)]">—</span>
              ) : (
                <AnimatedMetric value={kpis.avgWorkoutsPerWeekLast8} decimals={1} />
              )}
            </p>
            <p className="mt-1 text-[10px] leading-tight text-[var(--gym-text-secondary)]">
              {empty ? "brak treningów" : "z 8 tyg."}
            </p>
          </div>

          <div className={cn(TILE, "border-white/[0.08] bg-black/30")}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--gym-text-secondary)]">
              Czas
            </p>
            <p
              className="mt-1 flex items-baseline gap-1 font-display text-[34px] leading-none text-white"
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
                  <span className="font-heading text-[11px] text-[var(--gym-text-secondary)]">
                    min
                  </span>
                </>
              )}
            </p>
            <p className="mt-1 text-[10px] leading-tight text-[var(--gym-text-secondary)]">
              {empty ? "brak treningów" : `średnio ${durationCaption}`}
            </p>
          </div>
        </div>

        {weekBars.length > 1 ? (
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--gym-text-secondary)]">
              Tonaż w ostatnich {weekBars.length} tygodniach
            </p>
            <div
              className="flex h-14 items-end gap-1.5"
              role="img"
              aria-label={`Tonaż tygodniowy: ${weekBars
                .map((v) => `${(v / 1000).toFixed(1).replace(".", ",")} t`)
                .join(", ")}`}
            >
              {weekBars.map((v, i) => {
                const last = i === weekBars.length - 1;
                return (
                  <div
                    key={i}
                    className={cn(
                      "gym-bar-grow flex-1 rounded-t-md rounded-b-[2px]",
                      last
                        ? "bg-gradient-to-b from-[#f6e3a1] to-[var(--gym-gold)] shadow-[0_0_12px_rgba(246,227,161,0.5)]"
                        : "bg-[#3a2f18]",
                    )}
                    style={{
                      height: `${Math.max(8, (v / barMax) * 100)}%`,
                      animationDelay: `${i * 50}ms`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
