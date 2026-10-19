"use client";

import { AnimatedMetric } from "@/components/ui/animated-metric";
import type { ProgressIntelligence } from "@/lib/analytics";
import { cn } from "@/lib/utils";

function fmtDelta(n: number | null): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(n))}`;
}

export function IntelligenceStrip({
  data,
}: {
  data: ProgressIntelligence;
}) {
  const { fatigue, recovery, insights } = data;
  const topInsights = insights.slice(0, 3);

  return (
    <section className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/30 bg-gradient-to-b from-[rgba(var(--neon-rgb),0.14)] via-[var(--gym-surface-sunken)] to-[var(--gym-surface-sunken)] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            Fatigue
          </p>
          <p className="mt-1 flex items-baseline gap-1">
            <AnimatedMetric
              value={fatigue.score}
              className="text-[1.75rem] leading-none text-white"
            />
            <span className="text-[12px] text-white/40">/100</span>
          </p>
          <p className="mt-1 text-[11px] font-medium text-white/70">
            {fatigue.bandLabel}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[11px] tabular-nums",
              fatigue.delta7d != null && fatigue.delta7d > 0
                ? "text-rose-300"
                : fatigue.delta7d != null && fatigue.delta7d < 0
                  ? "text-emerald-300"
                  : "text-white/40",
            )}
          >
            {fmtDelta(fatigue.delta7d)} vs poprz. tydz.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[var(--gym-surface-sunken)] px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
            Recovery
          </p>
          <p className="mt-1 flex items-baseline gap-1">
            <AnimatedMetric
              value={recovery.score}
              className="text-[1.75rem] leading-none text-white"
            />
            <span className="text-[12px] text-white/40">%</span>
          </p>
          <p className="mt-1 text-[11px] font-medium leading-snug text-white/70">
            {recovery.readinessLine}
          </p>
          <p className="mt-0.5 text-[10px] text-white/35">{recovery.bandLabel}</p>
        </div>
      </div>

      {topInsights.length > 0 ? (
        <ul className="space-y-1.5 app-panel px-3 py-2.5">
          {topInsights.map((i) => (
            <li
              key={i.id}
              className={cn(
                "text-[12px] leading-snug",
                i.severity === "warn" && "text-amber-200/90",
                i.severity === "good" && "text-emerald-300/90",
                i.severity === "info" && "text-white/65",
              )}
            >
              {i.text}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="px-0.5 text-[10px] leading-snug text-white/35">
        {fatigue.recommendation}
      </p>
    </section>
  );
}
