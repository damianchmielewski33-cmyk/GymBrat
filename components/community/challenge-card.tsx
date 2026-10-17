"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import {
  joinChallengeAction,
  type ChallengeActionState,
} from "@/actions/challenges";
import { CommunityProgress } from "@/components/community/community-progress";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import type { ChallengeListItem } from "@/lib/community/challenges";
import { cn } from "@/lib/utils";

export function ChallengeCard({
  challenge,
  href,
  teamId,
}: {
  challenge: ChallengeListItem;
  href: string;
  teamId?: string | null;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [joinState, joinAction, joinPending] = useActionState(
    joinChallengeAction,
    {} as ChallengeActionState,
  );

  useEffect(() => {
    if (joinState.error) notifyError(joinState.error);
    if (joinState.ok) notifySaved("Dołączono do wyzwania");
  }, [joinState, notifyError, notifySaved]);

  const useGroup =
    challenge.scope === "group" || challenge.scope === "global";
  const pct = useGroup ? challenge.groupPct : challenge.myPct;
  const progressLabel = useGroup
    ? `${challenge.groupProgressDisplay} / ${challenge.targetDisplay}`
    : `${challenge.myProgressDisplay} / ${challenge.targetDisplay}`;

  return (
    <article className="app-card overflow-hidden p-0 transition-[border-color] hover:border-[var(--gym-gold)]/20">
      <div className="relative px-4 pb-4 pt-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[var(--gym-gold)]/14 to-transparent" />
        <div className="relative flex items-start gap-3">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/30 bg-black/45 text-3xl shadow-inner"
            aria-hidden
          >
            {challenge.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/55">
                {challenge.scopeLabel}
              </span>
              {challenge.completed ? (
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                  Ukończone
                </span>
              ) : null}
              {challenge.celebrationPending ? (
                <span className="rounded-full border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/15 px-2 py-1 text-[10px] font-semibold text-[var(--gym-gold)]">
                  Nagroda!
                </span>
              ) : null}
            </div>
            <h3 className="mt-1.5 truncate font-heading text-[17px] font-semibold tracking-tight text-white">
              {challenge.title}
            </h3>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-white/45">
              {challenge.description}
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-white/45">Postęp</span>
            <span className="font-metric tabular-nums text-white/80">
              {progressLabel}{" "}
              <span className="text-white/40">{challenge.unitLabel}</span>
            </span>
          </div>
          <CommunityProgress
            value={pct}
            label={`Postęp wyzwania ${challenge.title}: ${pct}%`}
            tone={challenge.completed ? "mint" : "gold"}
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
            <span>
              {challenge.participantCount}{" "}
              {challenge.participantCount === 1 ? "uczestnik" : "uczestników"}
            </span>
            <span className="font-semibold text-[var(--gym-gold)]">
              +{challenge.rewardXp} XP
            </span>
          </div>
        </div>

        <div className="relative mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href={href}
            className={cn(
              "inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] text-[13px] font-semibold text-white",
              "transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45",
            )}
          >
            Szczegóły
          </Link>
          {!challenge.joined ? (
            <form action={joinAction} className="flex-1">
              <input type="hidden" name="challengeId" value={challenge.id} />
              {teamId ? (
                <input type="hidden" name="teamId" value={teamId} />
              ) : null}
              <button
                type="submit"
                disabled={joinPending}
                aria-busy={joinPending}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[var(--gym-gold)] text-[13px] font-bold text-black transition hover:brightness-110 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
              >
                {joinPending ? "Dołączanie…" : "Dołącz"}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </article>
  );
}
