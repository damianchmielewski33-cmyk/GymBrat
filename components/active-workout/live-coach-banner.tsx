"use client";

import type { LiveCoachTip } from "@/lib/live-set-coach";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<LiveCoachTip["tone"], string> = {
  progress:
    "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-100/90 hover:bg-emerald-400/[0.14]",
  caution:
    "border-amber-400/30 bg-amber-400/[0.09] text-amber-50/90 hover:bg-amber-400/[0.14]",
  hold: "border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/[0.08] text-[var(--gym-gold-bright)]/90 hover:bg-[var(--gym-gold)]/[0.14]",
  info: "border-white/12 bg-white/[0.04] text-white/80 hover:bg-white/[0.07]",
};

const HIGHLIGHT_CLASS: Record<LiveCoachTip["tone"], string> = {
  progress: "text-emerald-300",
  caution: "text-amber-200",
  hold: "text-[var(--gym-gold)]",
  info: "text-white",
};

const ICON: Record<LiveCoachTip["tone"], string> = {
  progress: "🔥",
  caution: "⚠️",
  hold: "📌",
  info: "💡",
};

export function LiveCoachBanner({
  tip,
  onApply,
  className,
}: {
  tip: LiveCoachTip | null;
  onApply?: (apply: NonNullable<LiveCoachTip["apply"]>) => void;
  className?: string;
}) {
  if (!tip) return null;
  const clickable = Boolean(tip.apply && onApply);

  const inner = (
    <>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {ICON[tip.tone]}
      </span>
      <span className="min-w-0">
        {tip.highlight ? (
          <>
            {tip.prefix}
            <span
              className={cn(
                "font-semibold tabular-nums",
                HIGHLIGHT_CLASS[tip.tone],
              )}
            >
              {tip.highlight}
            </span>
            <span className="opacity-80">{tip.suffix}</span>
          </>
        ) : (
          tip.body
        )}
        {clickable ? (
          <span className="mt-1 block text-[11px] font-medium opacity-55">
            Stuknij, żeby wpisać
          </span>
        ) : null}
      </span>
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => tip.apply && onApply?.(tip.apply)}
        className={cn(
          "flex w-full items-start gap-2 rounded-2xl border px-3 py-2.5 text-left text-[13px] leading-snug transition",
          TONE_CLASS[tip.tone],
          className,
        )}
      >
        {inner}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full items-start gap-2 rounded-2xl border px-3 py-2.5 text-left text-[13px] leading-snug",
        TONE_CLASS[tip.tone],
        className,
      )}
      role="status"
    >
      {inner}
    </div>
  );
}
