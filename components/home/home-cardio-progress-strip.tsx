"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, CircleHelp, Footprints } from "lucide-react";
import type { ExtraCardioAdvice } from "@/lib/extra-cardio-from-macros";
import { cn } from "@/lib/utils";

type Props = {
  minutesCompleted: number;
  weeklyGoal: number;
  /** Wewnątrz karty „Trening na dziś” — bez osobnego app-card. */
  embedded?: boolean;
  extraCardio?: ExtraCardioAdvice | null;
};

function weeklyCardioPercent(minutesCompleted: number, weeklyGoal: number): number {
  if (weeklyGoal <= 0) return 0;
  return Math.min(100, Math.round((minutesCompleted / weeklyGoal) * 1000) / 10);
}

export function HomeCardioProgressStrip({
  minutesCompleted,
  weeklyGoal,
  embedded = false,
  extraCardio = null,
}: Props) {
  const tipId = useId();
  const [tipOpen, setTipOpen] = useState(false);
  const safe = weeklyCardioPercent(minutesCompleted, weeklyGoal);
  const mins = Math.round(minutesCompleted);
  const extraMinutes =
    extraCardio?.show && extraCardio.extraMinutes > 0
      ? extraCardio.extraMinutes
      : 0;

  // Skala = cel tygodnia + dodatkowe minuty (nadwyżka makro).
  // Nie ucinamy złotego do 100% kosztem niebieskiego — oba segmenty muszą być widoczne.
  const totalUnits = Math.max(weeklyGoal + extraMinutes, mins, 1);
  const goldPct = Math.min(100, (Math.min(mins, weeklyGoal) / totalUnits) * 100);
  const overGoalPct =
    mins > weeklyGoal
      ? Math.min(100 - goldPct, ((mins - weeklyGoal) / totalUnits) * 100)
      : 0;
  const bluePct =
    extraMinutes > 0
      ? Math.min(100 - goldPct - overGoalPct, (extraMinutes / totalUnits) * 100)
      : 0;

  return (
    <div
      className={cn(
        embedded
          ? "rounded-2xl border border-white/[0.08] bg-black/25 px-3 py-2.5"
          : "app-card-raised px-3.5 py-3",
      )}
    >
      <Link
        href="/cardio"
        className="block transition-colors hover:opacity-95"
        aria-label={
          extraMinutes > 0
            ? `Cardio w tygodniu: ${mins} z ${weeklyGoal} minut, plus ${extraMinutes} min dodatkowego cardio przy nadwyżce makro`
            : `Cardio w tygodniu: ${mins} z ${weeklyGoal} minut, ${safe.toFixed(safe >= 100 ? 0 : 1)} procent celu`
        }
      >
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/10",
              embedded ? "h-8 w-8" : "h-9 w-9",
            )}
          >
            <Footprints
              className={cn(
                "text-[var(--gym-gold)]",
                embedded ? "h-3.5 w-3.5" : "h-4 w-4",
              )}
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                Cardio · 7 dni
              </p>
              <p className="shrink-0 font-metric text-[13px] tabular-nums text-white">
                <span className="text-[var(--gym-gold)]">{mins}</span>
                <span className="text-white/35"> / {weeklyGoal} min</span>
                {extraMinutes > 0 ? (
                  <span className="ml-1.5 text-[11px] font-semibold text-sky-300">
                    +{extraMinutes} min
                  </span>
                ) : null}
              </p>
            </div>
            <div className="relative mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-l-full bg-gradient-to-r from-[var(--gym-gold-deep)] via-[var(--gym-gold)] to-[var(--gym-gold-bright)]"
                initial={false}
                animate={{ width: `${goldPct}%` }}
                transition={{ duration: 0.75, ease: "easeOut" }}
              />
              {overGoalPct > 0 ? (
                <motion.div
                  className="h-full bg-gradient-to-r from-[var(--gym-gold)]/70 to-[var(--gym-gold-bright)]/80"
                  title="Cardio powyżej celu tygodnia"
                  initial={false}
                  animate={{ width: `${overGoalPct}%` }}
                  transition={{ duration: 0.75, ease: "easeOut", delay: 0.03 }}
                />
              ) : null}
              {bluePct > 0 ? (
                <motion.div
                  className="h-full rounded-r-full bg-gradient-to-r from-sky-500/90 to-sky-300"
                  title="Dodatkowe cardio przy nadwyżce makro"
                  initial={false}
                  animate={{ width: `${bluePct}%` }}
                  transition={{ duration: 0.75, ease: "easeOut", delay: 0.05 }}
                />
              ) : null}
            </div>
            {!embedded ? (
              <p className="mt-1.5 text-[11px] text-white/40">
                {widthLabel(safe, extraMinutes)}
              </p>
            ) : extraMinutes > 0 ? (
              <p className="mt-1.5 text-[10px] leading-snug text-sky-200/80">
                Niebieskie pole: dodatkowe cardio na nadwyżkę makro
              </p>
            ) : null}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/25" aria-hidden />
        </div>
      </Link>

      {extraMinutes > 0 && extraCardio ? (
        <div className="mt-2 border-t border-white/[0.06] pt-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-200/90 transition hover:text-sky-100"
            aria-expanded={tipOpen}
            aria-controls={tipId}
            onClick={(e) => {
              e.preventDefault();
              setTipOpen((v) => !v);
            }}
          >
            <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {tipOpen ? "Ukryj wyjaśnienie" : "Jak liczone jest dodatkowe cardio?"}
          </button>
          {tipOpen ? (
            <div
              id={tipId}
              className="mt-2 space-y-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2.5 text-[11px] leading-snug text-sky-50/90"
            >
              <p className="font-semibold text-sky-100">{extraCardio.summary}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-sky-200/70">Open debt</dt>
                <dd className="font-medium text-sky-50">
                  {extraCardio.surplusKcal} kcal
                </dd>
                <dt className="text-sky-200/70">Effective debt</dt>
                <dd className="font-medium text-sky-50">
                  {extraCardio.effectiveSurplusKcal} kcal
                </dd>
                <dt className="text-sky-200/70">Cardio offset</dt>
                <dd className="font-medium text-sky-50">
                  {extraCardio.cardioOffsetKcal} kcal
                </dd>
                <dt className="text-sky-200/70">Spalanie</dt>
                <dd className="font-medium text-sky-50">
                  {extraCardio.burnKcalPerMin} kcal/min
                </dd>
                <dt className="text-sky-200/70">Źródło spalania</dt>
                <dd className="font-medium text-sky-50">
                  {burnSourceLabel(extraCardio.burnSource)}
                </dd>
              </dl>
              <ul className="list-disc space-y-1 border-t border-sky-400/15 pt-2 pl-4 text-sky-50/80">
                {extraCardio.explanation
                  .filter(
                    (line) =>
                      !line.startsWith("Open debt:") &&
                      !line.startsWith("Effective debt:") &&
                      !line.startsWith("Cardio offset:") &&
                      !line.startsWith("Spalanie:") &&
                      !line.startsWith("Źródło spalania:"),
                  )
                  .map((line) => (
                    <li key={line}>{line}</li>
                  ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function burnSourceLabel(
  source: NonNullable<ExtraCardioAdvice["burnSource"]>,
): string {
  switch (source) {
    case "calories_entered":
      return "Calories entered";
    case "personal_model":
      return "Personal model";
    case "heart_rate_model":
      return "Heart rate model";
    case "met_model":
    case "default":
      return "MET model";
    default:
      return source;
  }
}

function widthLabel(safe: number, extraMinutes: number): string {
  if (extraMinutes > 0) {
    return `Cel tygodnia + ${extraMinutes} min dodatkowych (nadwyżka makro)`;
  }
  if (safe >= 100) return "Cel tygodniowy zaliczony";
  return `${safe.toFixed(safe >= 100 ? 0 : 1)}% zalecenia · statystyki i porównania`;
}
