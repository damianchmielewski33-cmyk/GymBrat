"use client";

import type { LiveCoachTip } from "@/lib/live-set-coach";
import { hapticTap } from "@/lib/haptics";
import { formatKgPl } from "@/lib/set-progression-suggestion";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<LiveCoachTip["tone"], string> = {
  progress:
    "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100/90 hover:bg-emerald-400/[0.14]",
  caution:
    "border-amber-400/30 bg-amber-400/[0.09] text-amber-50/90 hover:bg-amber-400/[0.14]",
  hold: "border-[#D6B36A]/30 bg-[rgba(214,179,106,0.08)] text-[#F0D58A]/90 hover:bg-[rgba(214,179,106,0.14)]",
  info: "border-white/12 bg-white/[0.04] text-white/80 hover:bg-white/[0.07]",
};

const ICON: Record<LiveCoachTip["tone"], string> = {
  progress: "🔥",
  caution: "⚠️",
  hold: "📌",
  info: "💡",
};

/**
 * Zwięzły tip coacha: jedna linia po polsku (decyzja + opcjonalnie kg×reps).
 * Bez Readiness / Confidence / „Powód:”.
 */
export function LiveCoachBanner({
  tip,
  onApply,
  className,
  compact = false,
}: {
  tip: LiveCoachTip | null;
  onApply?: (apply: NonNullable<LiveCoachTip["apply"]>) => void;
  className?: string;
  /** Gęstszy padding — ten sam kontrakt copy co full. */
  compact?: boolean;
}) {
  if (!tip) return null;
  const clickable = Boolean(tip.apply && onApply);

  const headline = (tip.decision || tip.body).trim();
  const applyLine =
    tip.apply != null
      ? `${formatKgPl(tip.apply.weightKg)} kg × ${tip.apply.reps}`
      : null;

  const inner = (
    <>
      <span className="shrink-0" aria-hidden>
        {ICON[tip.tone]}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block font-semibold tracking-wide",
            compact ? "truncate text-[12px]" : "text-[13px]",
          )}
        >
          {headline}
        </span>
        {applyLine && tip.decision ? (
          <span
            className={cn(
              "mt-0.5 block tabular-nums opacity-75",
              compact ? "truncate text-[11px]" : "text-[12px]",
            )}
          >
            {applyLine}
          </span>
        ) : null}
      </span>
    </>
  );

  const shell = cn(
    "flex w-full items-start gap-2 border text-left leading-snug transition",
    compact
      ? "rounded-xl px-2.5 py-1.5 text-[12px]"
      : "rounded-2xl px-3 py-2.5 text-[13px]",
    TONE_CLASS[tip.tone],
    className,
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => {
          hapticTap();
          if (tip.apply) onApply?.(tip.apply);
        }}
        className={shell}
        aria-label={
          applyLine ? `${headline}. ${applyLine}` : headline
        }
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={shell} role="status">
      {inner}
    </div>
  );
}
