"use client";

import { useState } from "react";
import {
  formatPrDateLabel,
  formatPrWeightLabel,
  getPrAchievementImageUrl,
} from "@/lib/pr-achievement-image";
import { cn } from "@/lib/utils";

type Props = {
  exerciseName: string;
  valueKg: number;
  atMs?: number;
  className?: string;
};

/**
 * Karta świętowania rekordu: tło Pollinations + nakładka (GymBrat / NOWY MAX / kg).
 */
export function PrAchievementGraphic({
  exerciseName,
  valueKg,
  atMs,
  className,
}: Props) {
  const [failed, setFailed] = useState(false);
  const src = getPrAchievementImageUrl({ exerciseName, valueKg, atMs });
  const dateLabel = formatPrDateLabel(atMs);
  const weightLabel = formatPrWeightLabel(valueKg);
  const exerciseLabel = exerciseName.trim().toLocaleUpperCase("pl-PL");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/35 bg-black shadow-[0_0_40px_rgba(235,196,74,0.12)]",
        className,
      )}
    >
      <div className="relative aspect-[3/4] w-full">
        {!failed ? (
          // eslint-disable-next-line @next/next/no-img-element -- Pollinations URL z query
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <div
            className="absolute inset-0 bg-[#0a0a0a]"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 50% 35%, rgba(235,196,74,0.22), transparent 55%), linear-gradient(180deg, #121212 0%, #050505 100%)",
            }}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/25 to-black/90" />

        <div className="absolute inset-0 flex flex-col items-center px-5 pb-5 pt-6 text-center">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[var(--gym-gold)]">
            GymBrat
          </p>
          <p className="mt-3 text-[13px] font-bold uppercase tracking-[0.22em] text-[var(--gym-gold)]">
            Nowy max
          </p>
          <p
            className="mt-2 font-display text-[52px] font-semibold leading-none tracking-tight text-white"
            style={{ textShadow: "0 0 24px rgba(235,196,74,0.35)" }}
          >
            {weightLabel}
          </p>
          <p className="mt-3 max-w-[95%] text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold-bright)]">
            {exerciseLabel}
          </p>
          <p className="mt-2 text-sm tabular-nums text-white/80">{dateLabel}</p>
        </div>
      </div>
    </div>
  );
}
