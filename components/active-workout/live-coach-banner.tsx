"use client";

import type { LiveCoachTip } from "@/lib/live-set-coach";
import { hapticTap } from "@/lib/haptics";
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

  const metaLine = (
    <span className="mt-1.5 block text-[10px] leading-snug opacity-50">
      {tip.reason ? (
        <span className="block opacity-80">Powód: {tip.reason}</span>
      ) : null}
      <span className="tabular-nums">
        Readiness {tip.readiness}/100 · Confidence {tip.confidence}/100
      </span>
      {tip.suspicious || tip.confidence < 45 ? (
        <span className="mt-0.5 block text-amber-200/70">dane niepewne</span>
      ) : null}
    </span>
  );

  const inner = (
    <>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {ICON[tip.tone]}
      </span>
      <span className="min-w-0">
        {tip.decision ? (
          <span className="mb-0.5 block text-[11px] font-semibold tracking-wide opacity-90">
            {tip.decision}
          </span>
        ) : null}
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
        {metaLine}
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
        onClick={() => {
          hapticTap();
          if (tip.apply) onApply?.(tip.apply);
        }}
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
