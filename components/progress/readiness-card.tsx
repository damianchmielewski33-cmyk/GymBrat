"use client";

import { AnimatedMetric } from "@/components/ui/animated-metric";
import {
  Eyebrow,
  Meter,
  Surface,
} from "@/components/progress/progress-ui";
import type { FatigueBand, ProgressIntelligence } from "@/lib/analytics";
import { fmtSigned } from "@/lib/progress-format";
import { cn } from "@/lib/utils";

const FATIGUE_BAR: Record<FatigueBand, string> = {
  fresh: "bg-emerald-400",
  normal: "bg-[var(--gym-gold)]",
  fatigued: "bg-amber-400",
  overreached: "bg-rose-400",
};

/**
 * Gotowość do treningu: zmęczenie + regeneracja + 3 najważniejsze wskazówki.
 * Wcześniej ten pasek był doklejany nad KAŻDĄ zakładką (także Sylwetką i Zdjęciami).
 */
export function ReadinessCard({ data }: { data: ProgressIntelligence }) {
  const { fatigue, recovery, insights } = data;
  const tips = insights
    .filter((i) => i.text !== fatigue.recommendation)
    .slice(0, 3);

  const delta = fatigue.delta7d;
  const deltaTone =
    delta != null && delta > 0
      ? "text-rose-300"
      : delta != null && delta < 0
        ? "text-emerald-300"
        : "text-white/40";

  return (
    <Surface variant="hero" className="space-y-3">
      <div className="grid grid-cols-2 divide-x divide-white/10">
        <div className="pr-3">
          <Eyebrow gold>Zmęczenie</Eyebrow>
          <p className="mt-1.5 flex items-baseline gap-1">
            <AnimatedMetric
              value={fatigue.score}
              className="text-[1.9rem] leading-none text-white"
            />
            <span className="text-[12px] text-white/40">/100</span>
          </p>
          <Meter
            pct={fatigue.score}
            className="mt-2"
            barClassName={FATIGUE_BAR[fatigue.band]}
          />
          <p className="mt-1.5 text-[12px] font-medium text-white/75">
            {fatigue.bandLabel}
          </p>
          <p className={cn("mt-0.5 text-[11px] tabular-nums", deltaTone)}>
            {delta != null ? `${fmtSigned(delta, "", 0)} vs poprz. tydzień` : "—"}
          </p>
        </div>

        <div className="pl-3">
          <Eyebrow>Regeneracja</Eyebrow>
          <p className="mt-1.5 flex items-baseline gap-1">
            <AnimatedMetric
              value={recovery.score}
              className="text-[1.9rem] leading-none text-white"
            />
            <span className="text-[12px] text-white/40">%</span>
          </p>
          <Meter
            pct={recovery.score}
            className="mt-2"
            barClassName="bg-emerald-400"
          />
          <p className="mt-1.5 text-[12px] font-medium leading-snug text-white/75">
            {recovery.bandLabel}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/40">
            {recovery.readinessLine}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 border-t border-white/10 pt-2.5">
        <p className="text-[12px] leading-snug text-white/70">
          {fatigue.recommendation}
        </p>
        {tips.length > 0 ? (
          <ul className="space-y-1">
            {tips.map((i) => (
              <li
                key={i.id}
                className={cn(
                  "flex gap-2 text-[12px] leading-snug",
                  i.severity === "warn" && "text-amber-200/90",
                  i.severity === "good" && "text-emerald-300/90",
                  i.severity === "info" && "text-white/60",
                )}
              >
                <span
                  className="mt-[0.4em] h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                  aria-hidden
                />
                <span>{i.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Surface>
  );
}
