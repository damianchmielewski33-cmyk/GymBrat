"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, Minus, TrendingUp } from "lucide-react";
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

function DeltaChip({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  const valid = value != null && Number.isFinite(value);
  const rounded = valid ? Math.round(value * 10) / 10 : 0;
  const Icon = !valid || rounded === 0 ? Minus : rounded > 0 ? ArrowUp : ArrowDown;
  const tone = deltaTone(valid ? value : null);
  const toneBorder =
    !valid || rounded === 0
      ? "border-white/[0.08] bg-white/[0.03]"
      : rounded < 0
        ? "border-emerald-400/25 bg-emerald-500/[0.07]"
        : "border-rose-400/25 bg-rose-500/[0.07]";
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border px-2.5 py-2 tabular-nums",
        toneBorder,
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1 truncate text-[13px] font-semibold leading-none",
          tone,
        )}
      >
        <Icon className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{fmtSignedValue(value, unit)}</span>
      </p>
      <p className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-[0.1em] text-white/40">
        {label}
      </p>
    </div>
  );
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
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
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
                <span className="text-[15px] font-medium text-white/50">kg</span>
              </>
            ) : (
              <span className="font-metric text-[48px] leading-none text-white/35">
                —
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2" aria-label="Zmiany wagi">
          <DeltaChip
            label="od raportu"
            value={weightDeltaFromPreviousKg}
            unit="kg"
          />
          <DeltaChip label="od startu" value={weightFromStartKg} unit="kg" />
          <DeltaChip label="tempo" value={weightKgPerWeek} unit="kg/tydz" />
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
