"use client";

import { MiniSparkline } from "@/components/home/mini-sparkline";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import type { HomeStartSpark } from "@/lib/home-start";
import { cn } from "@/lib/utils";

const ROWS = [
  {
    key: "waist",
    label: "Pas",
    color: "#4ade80",
    lowerIsBetter: true,
  },
  {
    key: "thigh",
    label: "Udo",
    color: "#60a5fa",
    lowerIsBetter: true,
  },
  {
    key: "chest",
    label: "Klatka",
    color: "#c9a84a",
    lowerIsBetter: false,
  },
  {
    key: "arm",
    label: "Ramię",
    color: "#f472b6",
    lowerIsBetter: false,
  },
] as const;

function fmtDelta(n: number | null): string {
  if (n == null || !Number.isFinite(n) || Math.abs(n) < 0.05) return "—";
  const r = Math.round(n * 10) / 10;
  const sign = r > 0 ? "+" : "";
  return `${sign}${String(r).replace(".", ",")}`;
}

export function HomeObwodySection({
  waistCm,
  thighCm,
  chestCm,
  armCm,
  waistSpark,
  thighSpark,
  chestSpark,
  armSpark,
}: {
  waistCm: number | null;
  thighCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  waistSpark: HomeStartSpark[];
  thighSpark: HomeStartSpark[];
  chestSpark: HomeStartSpark[];
  armSpark: HomeStartSpark[];
}) {
  const byKey = {
    waist: { value: waistCm, spark: waistSpark },
    thigh: { value: thighCm, spark: thighSpark },
    chest: { value: chestCm, spark: chestSpark },
    arm: { value: armCm, spark: armSpark },
  } as const;

  return (
    <section className="space-y-3">
      <SectionLabel index={5} title="Obwody" trailing="od startu" />

      <div className="app-card divide-y divide-white/[0.06] overflow-hidden">
        {ROWS.map((row) => {
          const { value, spark } = byKey[row.key];
          const values = spark.map((s) => s.value);
          const start = values.length ? values[0]! : null;
          const current =
            value ?? (values.length ? values[values.length - 1]! : null);
          let delta: number | null = null;
          if (
            start != null &&
            current != null &&
            Number.isFinite(start) &&
            Number.isFinite(current)
          ) {
            delta = Math.round((current - start) * 10) / 10;
          }
          const improved =
            delta != null &&
            delta !== 0 &&
            (row.lowerIsBetter ? delta < 0 : delta > 0);
          const deltaColor =
            delta == null || Math.abs(delta) < 0.05
              ? "text-white/35"
              : improved
                ? "text-emerald-400"
                : delta < 0
                  ? "text-rose-400"
                  : row.color === "#c9a84a"
                    ? "text-[var(--gym-gold)]"
                    : "text-white/70";

          return (
            <div
              key={row.key}
              className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-4 py-3.5"
            >
              <p className="text-[13px] font-semibold text-white/85">
                {row.label}
              </p>
              <MiniSparkline
                values={values}
                color={row.color}
                className="h-10 w-full"
              />
              <div className="min-w-[4.25rem] text-right">
                {current != null && Number.isFinite(current) ? (
                  <div className="flex items-baseline justify-end gap-1">
                    <AnimatedMetric
                      value={current}
                      decimals={current % 1 === 0 ? 0 : 1}
                      className="text-[26px] leading-none text-white"
                    />
                    <span className="text-[11px] text-white/45">cm</span>
                  </div>
                ) : (
                  <span className="font-metric text-[26px] leading-none text-white/35">
                    —
                  </span>
                )}
                <p
                  className={cn(
                    "mt-0.5 text-[12px] font-medium tabular-nums",
                    deltaColor,
                  )}
                >
                  {fmtDelta(delta)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
