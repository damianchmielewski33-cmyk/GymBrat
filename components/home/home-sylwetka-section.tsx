"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BRAND_GOLD } from "@/lib/brand-colors";
import type {
  HomeStartSpark,
  HomeStartWaistPoint,
  HomeStartWeightPoint,
} from "@/lib/home-start";

type Metric = "weight" | "waist" | "arm" | "chest";

const MAX_POINTS = 30;

function fmtSigned(n: number, unit: string, extra = ""): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return `bez zmian${extra}`;
  const sign = r > 0 ? "+" : "−";
  return `${sign}${String(Math.abs(r)).replace(".", ",")} ${unit}${extra}`;
}

function daysAgoLabel(days: number): string {
  if (days === 0) return "dziś";
  if (days === 1) return "wczoraj";
  return `${days} dni temu`;
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
  });
}

function Sparkline({
  points,
  label,
}: {
  points: Array<{ date: string; v: number }>;
  label: string;
}) {
  if (points.length < 2) {
    return (
      <p className="mt-3 text-[13px] text-white/60">
        Wykres pojawi się po drugim raporcie.
      </p>
    );
  }
  const vs = points.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const xy = points.map((p, i) => [
    10 + (i * 320) / (points.length - 1),
    80 - ((p.v - min) / span) * 64,
  ]);
  const last = xy[xy.length - 1]!;
  return (
    <div className="mt-3">
      <svg
        viewBox="0 0 340 90"
        width="100%"
        height="90"
        role="img"
        aria-label={label}
        className="block"
      >
        <polyline
          pathLength={1}
          className="gym-draw"
          points={xy.map(([x, y]) => `${x.toFixed(0)},${y.toFixed(0)}`).join(" ")}
          fill="none"
          stroke={BRAND_GOLD}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className="gym-draw-dot" cx={last[0]} cy={last[1]} r={5} fill={BRAND_GOLD} />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-white/60">
        <span>{shortDate(points[0]!.date)}</span>
        <span>{shortDate(points[points.length - 1]!.date)}</span>
      </div>
    </div>
  );
}

/** Sylwetka: jedna karta, przełącznik Waga / Pas; zakresy wykresu są w Analizie. */
export function HomeSylwetkaSection({
  weightKg,
  weightKgPerWeek,
  daysSinceLastReport,
  weightSeries,
  waistSeries,
  armSeries = [],
  chestSeries = [],
}: {
  weightKg: number | null;
  weightDeltaFromPreviousKg: number | null;
  weightFromStartKg?: number | null;
  weightKgPerWeek: number | null;
  lastReportLabel: string | null;
  daysSinceLastReport: number | null;
  weightSeries: HomeStartWeightPoint[];
  waistSeries: HomeStartWaistPoint[];
  armSeries?: HomeStartSpark[];
  chestSeries?: HomeStartSpark[];
}) {
  const [metric, setMetric] = useState<Metric>("weight");

  const wSorted = [...weightSeries].sort((a, b) => a.date.localeCompare(b.date));
  const sSorted = [...waistSeries].sort((a, b) => a.date.localeCompare(b.date));
  const isWeight = metric === "weight";
  const byDate = (a: { date: string }, b: { date: string }) =>
    a.date.localeCompare(b.date);
  const aSorted = [...armSeries].sort(byDate);
  const cSorted = [...chestSeries].sort(byDate);

  const series = (
    metric === "weight"
      ? wSorted.map((p) => ({ date: p.date, v: p.kg }))
      : metric === "waist"
        ? sSorted.map((p) => ({ date: p.date, v: p.cm }))
        : (metric === "arm" ? aSorted : cSorted).map((p) => ({
            date: p.date,
            v: p.value,
          }))
  ).slice(-MAX_POINTS);
  const metricName =
    metric === "weight"
      ? "wagi"
      : metric === "waist"
        ? "obwodu pasa"
        : metric === "arm"
          ? "obwodu ramienia"
          : "obwodu klatki";

  // Jedno źródło prawdy: wartość = ostatni punkt wykresu (gdy jest), inaczej wartość z profilu.
  const lastPoint = series[series.length - 1]?.v ?? null;
  const value = isWeight ? (lastPoint ?? weightKg) : lastPoint;
  const prev = series.length >= 2 ? series[series.length - 2]!.v : null;
  const delta = value != null && prev != null ? value - prev : null;
  const unit = isWeight ? "kg" : "cm";

  const deltaText =
    delta == null
      ? "Za mało danych do porównania"
      : `${fmtSigned(delta, unit)} od poprzedniego pomiaru${
          isWeight && weightKgPerWeek != null
            ? ` · ${fmtSigned(weightKgPerWeek, "kg/tydz.")}`
            : ""
        }`;

  const decimals = value != null && Number.isInteger(value) ? 0 : 1;

  if (wSorted.length === 0 && sSorted.length === 0 && weightKg == null) {
    return (
      <section className="app-card p-5" aria-labelledby="home-syl-h">
        <h2 id="home-syl-h" className="text-[13px] font-semibold text-white/60">
          Sylwetka
        </h2>
        <p className="mt-3 text-[18px] font-semibold text-white">Dodaj pierwszy raport</p>
        <p className="mt-1 text-sm leading-relaxed text-white/60">
          Waga, wymiary i zdjęcia widzisz tylko Ty. Po drugim raporcie pojawi się wykres zmian.
        </p>
        <Link
          href="/reports?new=1"
          className="gym-tap mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/20 text-[15px] font-semibold text-white"
        >
          Dodaj raport
        </Link>
      </section>
    );
  }

  return (
    <section className="app-card p-5" aria-labelledby="home-syl-h">
      <div className="flex items-center justify-between gap-3">
        <h2 id="home-syl-h" className="text-[13px] font-semibold text-white/60">
          Sylwetka
        </h2>
        {daysSinceLastReport != null ? (
          <span className="text-xs text-white/60">
            Ostatni raport: {daysAgoLabel(daysSinceLastReport)}
          </span>
        ) : null}
      </div>
      <SegmentedControl
        className="mt-3"
        ariaLabel="Wskaźnik sylwetki"
        value={metric}
        onChange={setMetric}
        options={[
          { value: "weight", label: "Waga" },
          { value: "waist", label: "Pas" },
          { value: "arm", label: "Ramię" },
          { value: "chest", label: "Klatka" },
        ]}
      />

      <p className="mt-4 flex items-baseline gap-2">
        {value != null ? (
          <>
            <AnimatedMetric
              key={metric}
              value={value}
              decimals={decimals}
              className="text-[56px] leading-none text-white"
            />
            <span className="text-[15px] text-white/60">{unit}</span>
          </>
        ) : (
          <span className="font-metric text-[56px] leading-none text-white/50">—</span>
        )}
      </p>
      <p className={"mt-1 text-sm " + (delta == null ? "text-white/60" : "text-state-success")}>
        {deltaText}
      </p>

      <Sparkline
        key={metric}
        points={series}
        label={`Wykres ${metricName}, ostatnia wartość ${value ?? "brak"} ${unit}`}
      />

      <Link
        href="/progress"
        className="gym-tap mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/20 px-4 text-[15px] font-semibold text-white"
      >
        Wszystkie postępy: siła, sylwetka, zdjęcia
      </Link>
    </section>
  );
}
