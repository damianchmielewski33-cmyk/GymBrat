"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { HomeSylwetkaChart } from "@/components/home/home-sylwetka-chart";
import type { HomeStartWaistPoint, HomeStartWeightPoint } from "@/lib/home-start";
import { cn } from "@/lib/utils";

function fmtSignedValue(n: number | null, unit: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const r = Math.round(n * 10) / 10;
  const sign = r > 0 ? "+" : "";
  return `${sign}${String(r).replace(".", ",")} ${unit}`;
}

function deltaTone(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "text-white/45";
  return n < 0 ? "text-emerald-400" : "text-rose-400";
}

export function HomeSylwetkaSection({
  weightKg,
  weightDeltaFromPreviousKg,
  weightFromStartKg,
  weightKgPerWeek,
  lastReportLabel,
  weightSeries,
  waistSeries,
}: {
  weightKg: number | null;
  weightDeltaFromPreviousKg: number | null;
  weightFromStartKg: number | null;
  weightKgPerWeek: number | null;
  lastReportLabel: string | null;
  weightSeries: HomeStartWeightPoint[];
  waistSeries: HomeStartWaistPoint[];
}) {
  return (
    <section className="space-y-3">
      <SectionLabel
        index={1}
        title="Sylwetka"
        trailing={
          lastReportLabel ? `ostatni raport ${lastReportLabel}` : "brak raportu"
        }
      />

      <div className="app-card space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-white/55">Waga</p>
            <div className="mt-1 flex items-baseline gap-2">
              {weightKg != null && Number.isFinite(weightKg) ? (
                <>
                  <AnimatedMetric
                    value={weightKg}
                    decimals={1}
                    className="text-[48px] leading-none text-white"
                  />
                  <span className="text-[15px] font-medium text-white/50">kg</span>
                </>
              ) : (
                <span className="font-metric text-[48px] leading-none text-white/35">
                  —
                </span>
              )}
            </div>
          </div>

          <div
            className="grid shrink-0 grid-cols-[auto_auto] items-baseline gap-x-1.5 gap-y-1 text-[12px] tabular-nums"
            aria-label="Zmiany wagi"
          >
            <span className={cn("text-right", deltaTone(weightDeltaFromPreviousKg))}>
              {fmtSignedValue(weightDeltaFromPreviousKg, "kg")}
            </span>
            <span className="text-white/35">od raportu</span>
            <span className={cn("text-right", deltaTone(weightFromStartKg))}>
              {fmtSignedValue(weightFromStartKg, "kg")}
            </span>
            <span className="text-white/35">od startu</span>
            <span className={cn("text-right", deltaTone(weightKgPerWeek))}>
              {fmtSignedValue(weightKgPerWeek, "kg/tydz")}
            </span>
            <span className="text-white/35">tempo</span>
          </div>
        </div>

        <HomeSylwetkaChart data={weightSeries} waist={waistSeries} />

        <Link
          href="/progress"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <TrendingUp className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
          Wszystkie postępy: siła, sylwetka, zdjęcia
        </Link>
      </div>
    </section>
  );
}
