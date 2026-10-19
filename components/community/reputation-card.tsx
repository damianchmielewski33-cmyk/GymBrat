"use client";

import { Crown } from "lucide-react";
import { ReputationBadge } from "@/components/community/reputation-badge";
import {
  REPUTATION_TIER_META,
  REPUTATION_THRESHOLDS,
  REPUTATION_TIERS,
  type ReputationPublic,
} from "@/lib/community/reputation";
import { cn } from "@/lib/utils";

export function ReputationCard({
  reputation,
}: {
  reputation: ReputationPublic;
}) {
  const meta = REPUTATION_TIER_META[reputation.tier];
  return (
    <section className="app-card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
            Reputacja Community
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ReputationBadge reputation={reputation} size="md" showPoints />
            <span className={cn("text-[13px] font-medium", meta.textClass)}>
              {reputation.points} RP
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-white/45">
            {meta.exclusive}
          </p>
        </div>
        <Crown className={cn("h-5 w-5 shrink-0", meta.textClass)} aria-hidden />
      </div>

      {reputation.nextTier ? (
        <div>
          <div className="mb-1.5 flex justify-between text-[11px] text-white/40">
            <span>Do {REPUTATION_TIER_META[reputation.nextTier].label}</span>
            <span className="font-metric tabular-nums">
              {reputation.pointsToNext} RP
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--gym-gold-deep)] to-[var(--neon)]"
              style={{
                width: `${Math.round(reputation.progressToNext * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-[var(--neon)]">
          Osiągnąłeś najwyższy poziom — Legend.
        </p>
      )}

      <ul className="flex flex-wrap gap-1.5">
        {REPUTATION_TIERS.map((t) => {
          const unlocked =
            reputation.points >= REPUTATION_THRESHOLDS[t];
          return (
            <li
              key={t}
              className={cn(
                "rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                unlocked
                  ? REPUTATION_TIER_META[t].pillClass
                  : "border-white/8 bg-white/[0.03] text-white/25",
              )}
            >
              {REPUTATION_TIER_META[t].label}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
