"use client";

import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import type { ProgressIntelligence } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function WeekIntelligencePanel({
  data,
}: {
  data: ProgressIntelligence;
}) {
  const { cardio, adherence, consistency } = data;

  return (
    <div className="space-y-3.5">
      <section className="space-y-2">
        <SectionLabel
          className="items-center"
          index="C"
          title="Cardio Load · strefy HR"
          titleTone="white"
        />
        <div className="space-y-2.5 app-panel px-3.5 py-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                Load
              </p>
              <p className="mt-1 font-metric text-[1.5rem] leading-none text-white">
                <AnimatedMetric value={cardio.load} decimals={0} />
              </p>
              <p className="mt-1 text-[11px] text-white/45">{cardio.loadLabel}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                Kcal (tyg.)
              </p>
              <p className="mt-1 font-metric text-[1.25rem] leading-none text-white">
                {cardio.caloriesEstimatedWeek.toLocaleString("pl-PL")}
              </p>
              {cardio.hrMax != null ? (
                <p className="mt-1 text-[11px] text-white/40">
                  HRmax ≈ {cardio.hrMax}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5 border-t border-white/[0.06] pt-2.5">
            {cardio.zones.map((z) => (
              <div key={z.zone} className="text-center">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
                  Z{z.zone}
                </p>
                <p className="mt-0.5 font-metric text-[13px] tabular-nums text-white">
                  {Math.round(z.minutes)}
                </p>
                <p className="text-[9px] text-white/30">min</p>
              </div>
            ))}
          </div>

          <p
            className={cn(
              "text-[12px] leading-snug",
              cardio.performance.verdict === "improved" && "text-emerald-300",
              cardio.performance.verdict === "declined" && "text-rose-300",
              cardio.performance.verdict === "stable" && "text-white/55",
              cardio.performance.verdict === "insufficient_data" &&
                "text-white/40",
            )}
          >
            {cardio.performance.verdictLabel}
            {cardio.performance.hrThen != null &&
            cardio.performance.hrNow != null
              ? ` · HR ${cardio.performance.hrThen} → ${cardio.performance.hrNow}`
              : ""}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <SectionLabel
          className="items-center"
          index="A"
          title="Adherence · Consistency"
          titleTone="white"
        />
        <div className="space-y-2.5 app-panel px-3.5 py-3">
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                { label: "Overall", value: adherence.overallPct },
                { label: "Trening", value: adherence.trainingPct },
                { label: "Dieta", value: adherence.dietPct },
                { label: "Cardio", value: adherence.cardioPct },
              ] as const
            ).map((cell) => (
              <div key={cell.label} className="text-center">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
                  {cell.label}
                </p>
                <p className="mt-1 font-metric text-[1.15rem] tabular-nums text-white">
                  {cell.value != null ? `${cell.value}%` : "—"}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-white/[0.06] pt-2.5">
            <p className="text-[11px] text-white/45">Ten tydzień</p>
            <p className="mt-1 text-[13px] text-white/85">
              Zaplanowane{" "}
              <span className="font-metric text-white">
                {consistency.week.planned}
              </span>
              <span className="mx-1 text-white/25">·</span>
              Wykonane{" "}
              <span className="font-metric text-white">
                {consistency.week.done}
              </span>
              <span className="mx-1 text-white/25">·</span>
              Consistency{" "}
              <span className="font-metric text-[var(--gym-gold)]">
                {consistency.week.scorePct}%
              </span>
            </p>
            <p className="mt-1 text-[11px] text-white/35">
              30 dni: {consistency.month.done}/{consistency.month.planned} ·{" "}
              {consistency.month.scorePct}% · 90 dni:{" "}
              {consistency.days90.scorePct}%
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
