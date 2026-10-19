"use client";

import { cn } from "@/lib/utils";
import {
  REPUTATION_TIER_META,
  type ReputationPublic,
  type ReputationTier,
} from "@/lib/community/reputation";

export function ReputationBadge({
  reputation,
  size = "sm",
  showPoints = false,
  className,
}: {
  reputation: ReputationPublic | ReputationTier | null | undefined;
  size?: "xs" | "sm" | "md";
  showPoints?: boolean;
  className?: string;
}) {
  if (!reputation) return null;
  const tier =
    typeof reputation === "string" ? reputation : reputation.tier;
  const points = typeof reputation === "string" ? null : reputation.points;
  const meta = REPUTATION_TIER_META[tier];
  if (!meta) return null;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border font-semibold uppercase tracking-wide",
        meta.pillClass,
        size === "xs" && "px-1.5 py-0.5 text-[9px]",
        size === "sm" && "px-2 py-0.5 text-[10px]",
        size === "md" && "px-2.5 py-1 text-[11px]",
        className,
      )}
      title={
        points != null
          ? `${meta.label} · ${points} RP · ${meta.exclusive}`
          : meta.exclusive
      }
    >
      <span className="truncate">{meta.label}</span>
      {showPoints && points != null ? (
        <span className="font-metric font-normal tabular-nums opacity-80">
          {points}
        </span>
      ) : null}
    </span>
  );
}

/** Avatar z kolorowym ringiem tieru. */
export function ReputationAvatar({
  initials,
  reputation,
  className,
}: {
  initials: string;
  reputation?: ReputationPublic | null;
  className?: string;
}) {
  const tier = reputation?.tier ?? "bronze";
  const meta = REPUTATION_TIER_META[tier];
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white ring-2 ring-offset-2 ring-offset-[#0c0c0e]",
        meta.ringClass,
        className,
      )}
      title={reputation ? `${meta.label} · ${reputation.points} RP` : undefined}
    >
      {initials.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function ReputationExclusiveMark({
  reputation,
}: {
  reputation?: ReputationPublic | null;
}) {
  if (!reputation) return null;
  if (
    reputation.tier !== "gold" &&
    reputation.tier !== "platinum" &&
    reputation.tier !== "diamond" &&
    reputation.tier !== "legend"
  ) {
    return null;
  }
  return (
    <span
      className={cn(
        "ml-1 inline-block align-middle text-[10px]",
        REPUTATION_TIER_META[reputation.tier].textClass,
      )}
      aria-label={REPUTATION_TIER_META[reputation.tier].exclusive}
      title={REPUTATION_TIER_META[reputation.tier].exclusive}
    >
      ◆
    </span>
  );
}
