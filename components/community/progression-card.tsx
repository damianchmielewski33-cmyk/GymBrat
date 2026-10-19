"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { prestigeUpAction } from "@/actions/community-progression";
import type { UserProgressionView } from "@/lib/community/progression-types";
import { CommunityProgress } from "@/components/community/community-progress";

export function ProgressionCard({ view }: { view: UserProgressionView }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <section className="app-card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(235,196,74,0.12),transparent_55%)]" />
      <div className="relative space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/40">
              User Level
            </p>
            <p className="font-metric text-[40px] leading-none text-white">
              {view.level}
            </p>
            {view.prestigeLabel ? (
              <p className="mt-1 text-[12px] text-[var(--neon)]">
                ✦ {view.prestigeLabel}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-white/40">
              Season Lv.
            </p>
            <p className="font-metric text-[22px] text-[var(--gym-gold)]">
              {view.seasonLevel}
            </p>
          </div>
        </div>
        <CommunityProgress
          value={view.pct}
          label={`Do poziomu ${Math.min(50, view.level + 1)}: ${view.pct}%`}
        />
        <p className="text-[11px] text-white/40">
          {view.intoLevel} / {view.needForNext} XP · łącznie{" "}
          {view.xpTotal.toLocaleString("pl-PL")}
        </p>
        {view.canPrestige ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await prestigeUpAction();
                router.refresh();
              })
            }
            className="rounded-xl border border-[var(--neon)]/40 bg-[var(--neon)]/15 px-4 py-2 text-[13px] font-medium text-[var(--neon)] disabled:opacity-50"
          >
            Prestige ↑
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function CommunityLevelBanner({
  level,
  pct,
}: {
  level: number;
  pct: number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-white/40">
        Community Level
      </p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="font-metric text-[24px] text-white">{level}</p>
        <p className="text-[12px] text-white/45">{pct}% do następnego</p>
      </div>
    </div>
  );
}
