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

  const totalUnits = Math.max(weeklyGoal + extraMinutes, 1);
  const goldPct = Math.min(100, (mins / totalUnits) * 100);
  const bluePct =
    extraMinutes > 0 ? Math.min(100 - goldPct, (extraMinutes / totalUnits) * 100) : 0;

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
              {bluePct > 0 ? (
                <motion.div
                  className="ml-auto h-full rounded-r-full bg-gradient-to-r from-sky-500/90 to-sky-300"
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
              className="mt-2 space-y-1.5 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2.5 text-[11px] leading-snug text-sky-50/90"
            >
              <p className="font-semibold text-sky-100">{extraCardio.summary}</p>
              <ul className="list-disc space-y-1 pl-4">
                {extraCardio.explanation.map((line) => (
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

function widthLabel(safe: number, extraMinutes: number): string {
  if (extraMinutes > 0) {
    return `Cel tygodnia + ${extraMinutes} min dodatkowych (nadwyżka makro)`;
  }
  if (safe >= 100) return "Cel tygodniowy zaliczony";
  return `${safe.toFixed(safe >= 100 ? 0 : 1)}% zalecenia · kliknij, by dodać wpis`;
}
