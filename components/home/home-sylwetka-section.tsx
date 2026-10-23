"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, TrendingUp, type LucideIcon } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { HomeSylwetkaChart } from "@/components/home/home-sylwetka-chart";
import type { HomeStartWaistPoint, HomeStartWeightPoint } from "@/lib/home-start";

const WAIST_GREEN = "#86efac";

function fmtSignedValue(n: number | null, unit: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const r = Math.round(n * 10) / 10;
  const sign = r > 0 ? "+" : "";
  return `${sign}${String(r).replace(".", ",")} ${unit}`;
}

function daysAgoLabel(days: number): string {
  if (days === 0) return "dziś";
  if (days === 1) return "wczoraj";
  return `${days} dni temu`;
}

/** Kafelek zmiany od raportu — neutralne kolory, tylko strzałka w kolorze serii. */
function DeltaTile({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number | null;
  unit: string;
  accent: string;
}) {
  const valid = value != null && Number.isFinite(value);
  const rounded = valid ? Math.round(value * 10) / 10 : 0;
  const Icon: LucideIcon =
    !valid || rounded === 0 ? Minus : rounded > 0 ? ArrowUp : ArrowDown;
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 tabular-nums">
      <p className="flex items-center gap-1.5 truncate text-[16px] font-semibold leading-none text-white">
        <Icon
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: accent }}
          strokeWidth={2.5}
          aria-hidden
        />
        <span className="truncate">{fmtSignedValue(value, unit)}</span>
      </p>
      <p className="mt-2 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-white/50">
        {label}
      </p>
    </div>
  );
}

function TempoTile({ value }: { value: number | null }) {
  const valid = value != null && Number.isFinite(value);
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 tabular-nums">
      <p className="truncate text-[16px] font-semibold leading-none text-white">
        {valid ? fmtSignedValue(value, "kg/tydz") : "Za mało danych"}
      </p>
      <p className="mt-2 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-white/50">
        {valid ? "tempo" : "tempo · min. 3 pomiary"}
      </p>
    </div>
  );
}

export function HomeSylwetkaSection({
  weightKg,
  weightDeltaFromPreviousKg,
  weightKgPerWeek,
  lastReportLabel,
  daysSinceLastReport,
  weightSeries,
  waistSeries,
}: {
  weightKg: number | null;
  weightDeltaFromPreviousKg: number | null;
  /** Zostaje w propsach dla zgodności; kafelek „od startu” zniknął z układu. */
  weightFromStartKg?: number | null;
  weightKgPerWeek: number | null;
  lastReportLabel: string | null;
  daysSinceLastReport: number | null;
  weightSeries: HomeStartWeightPoint[];
  waistSeries: HomeStartWaistPoint[];
}) {
  const waistSorted = [...waistSeries].sort((a, b) => a.date.localeCompare(b.date));
  const waistLast = waistSorted[waistSorted.length - 1]?.cm ?? null;
  const waistPrev = waistSorted[waistSorted.length - 2]?.cm ?? null;
  const waistDelta =
    waistLast != null && waistPrev != null ? waistLast - waistPrev : null;

  return (
    <section className="space-y-3">
      <SectionLabel
        index={1}
        title="Sylwetka"
        trailing={
          lastReportLabel ? (
            <span className="inline-flex items-center gap-2">
              <span>ostatni raport {lastReportLabel}</span>
              {daysSinceLastReport != null ? (
                <span className="rounded-full bg-[var(--gym-gold)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--gym-gold)]">
                  {daysAgoLabel(daysSinceLastReport)}
                </span>
              ) : null}
            </span>
          ) : (
            "brak raportu"
          )
        }
      />

      <div className="app-card space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Waga
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              {weightKg != null && Number.isFinite(weightKg) ? (
                <>
                  <AnimatedMetric
                    value={weightKg}
                    decimals={1}
                    className="text-[48px] leading-none text-white"
                  />
                  <span className="text-[15px] font-medium text-white/55">kg</span>
                </>
              ) : (
                <span className="font-metric text-[48px] leading-none text-white/35">
                  —
                </span>
              )}
            </div>
          </div>

          <div className="min-w-0 text-right">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: WAIST_GREEN }}
            >
              Pas
            </p>
            <div className="mt-1.5 flex items-baseline justify-end gap-1.5">
              {waistLast != null && Number.isFinite(waistLast) ? (
                <>
                  <AnimatedMetric
                    value={waistLast}
                    decimals={Number.isInteger(waistLast) ? 0 : 1}
                    className="text-[32px] leading-none text-white"
                  />
                  <span className="text-[14px] font-medium text-white/55">cm</span>
                </>
              ) : (
                <span className="font-metric text-[32px] leading-none text-white/35">
                  —
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2" aria-label="Zmiany od ostatniego raportu">
          <DeltaTile
            label="waga od raportu"
            value={weightDeltaFromPreviousKg}
            unit="kg"
            accent="var(--gym-gold)"
          />
          <DeltaTile
            label="pas od raportu"
            value={waistDelta}
            unit="cm"
            accent={WAIST_GREEN}
          />
          <TempoTile value={weightKgPerWeek} />
        </div>

        <HomeSylwetkaChart data={weightSeries} waist={waistSeries} />

        <Link
          href="/progress"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-[14px] font-medium text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <TrendingUp className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
          Wszystkie postępy: siła, sylwetka, zdjęcia
        </Link>
      </div>
    </section>
  );
}
