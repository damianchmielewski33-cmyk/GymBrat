"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { MessageCircle, Trophy } from "lucide-react";
import {
  joinChallengeAction,
  type ChallengeActionState,
} from "@/actions/challenges";
import { CommunityProgress } from "@/components/community/community-progress";
import { WorkoutChatPanel } from "@/components/community/workout-chat-panel";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import type { ChallengeDetailView as ChallengeDetail } from "@/lib/community/challenges";
import { cn } from "@/lib/utils";

export function ChallengeDetailClient({
  challenge,
  viewerUserId,
  backHref,
}: {
  challenge: ChallengeDetail;
  viewerUserId: string;
  backHref: string;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [joinState, joinAction, joinPending] = useActionState(
    joinChallengeAction,
    {} as ChallengeActionState,
  );

  useEffect(() => {
    if (joinState.error) notifyError(joinState.error);
    if (joinState.ok) notifySaved("Dołączono");
  }, [joinState, notifyError, notifySaved]);

  const useGroup =
    challenge.scope === "group" || challenge.scope === "global";
  const pct = useGroup ? challenge.groupPct : challenge.myPct;
  const progressLabel = useGroup
    ? `${challenge.groupProgressDisplay} / ${challenge.targetDisplay}`
    : `${challenge.myProgressDisplay} / ${challenge.targetDisplay}`;

  return (
    <div className="space-y-5">
      <Link
        href={backHref}
        className="inline-flex min-h-10 items-center text-[13px] text-white/55 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45"
      >
        ← Wyzwania
      </Link>

      <section className="app-card overflow-hidden p-0">
        <div className="relative px-4 pb-5 pt-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(212,175,55,0.18),transparent_55%)]" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-[var(--gym-gold)]/35 bg-black/50 text-4xl">
              {challenge.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--gym-gold)]">
                {challenge.scopeLabel}
              </p>
              <h1 className="mt-1 font-heading text-[24px] font-semibold leading-tight text-white">
                {challenge.title}
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-white/50">
                {challenge.description}
              </p>
            </div>
          </div>

          <div className="relative mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-white/40">
                  {useGroup ? "Postęp grupy" : "Twój postęp"}
                </p>
                <p className="mt-1 font-metric text-[28px] tabular-nums text-white">
                  {progressLabel}
                  <span className="ml-1 text-[14px] text-white/45">
                    {challenge.unitLabel}
                  </span>
                </p>
              </div>
              <p className="font-metric text-[22px] text-[var(--gym-gold)]">
                {pct}%
              </p>
            </div>
            <CommunityProgress
              className="mt-3 h-3"
              value={pct}
              label={`Postęp wyzwania ${challenge.title}: ${pct}%`}
              tone={challenge.completed ? "mint" : "gold"}
            />
            {!useGroup && challenge.joined ? (
              <p className="mt-2 text-[11px] text-white/40">
                Wkład w grupę: {challenge.myProgressDisplay} {challenge.unitLabel}
              </p>
            ) : null}
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase text-white/40">XP</p>
              <p className="font-metric text-[16px] text-[var(--gym-gold)]">
                +{challenge.rewardXp}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase text-white/40">Odznaka</p>
              <p className="truncate text-[13px] font-semibold text-white">
                {challenge.rewardTitle ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-center">
              <p className="text-[10px] uppercase text-white/40">Poziom</p>
              <p className="font-metric text-[16px] text-white">
                {challenge.myXp.level}
              </p>
            </div>
          </div>

          {!challenge.joined ? (
            <form action={joinAction} className="relative mt-4">
              <input type="hidden" name="challengeId" value={challenge.id} />
              {challenge.teamId ? (
                <input type="hidden" name="teamId" value={challenge.teamId} />
              ) : null}
              <button
                type="submit"
                disabled={joinPending}
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--gym-gold)] text-[14px] font-bold text-black disabled:opacity-50"
              >
                {joinPending ? "Dołączanie…" : "Dołącz do wyzwania"}
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="app-card space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
          <h2 className="text-[15px] font-semibold text-white">Ranking</h2>
        </div>
        {challenge.leaderboard.length === 0 ? (
          <p className="text-[13px] text-white/45">
            Brak wyników — zalicz trening, by wejść na tablicę.
          </p>
        ) : (
          <ol className="space-y-1">
            {challenge.leaderboard.map((row) => (
              <li
                key={row.userId}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-2 py-2",
                  row.userId === viewerUserId && "bg-[var(--gym-gold)]/8",
                )}
              >
                <span
                  className={cn(
                    "font-metric w-6 text-center text-[15px]",
                    row.rank <= 3
                      ? "text-[var(--gym-gold)]"
                      : "text-white/35",
                  )}
                >
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">
                  {row.displayName}
                  {row.completed ? " ✓" : ""}
                </span>
                <span className="font-metric shrink-0 text-sm tabular-nums text-white/70">
                  {row.valueDisplay}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {challenge.badges.length > 0 ? (
        <section className="app-card space-y-3 p-5">
          <h2 className="text-[15px] font-semibold text-white">Twoje odznaki</h2>
          <ul className="grid grid-cols-2 gap-2">
            {challenge.badges.map((b) => (
              <li
                key={b.badgeKey}
                className="rounded-2xl border border-[var(--gym-gold)]/20 bg-[var(--gym-gold)]/[0.06] px-3 py-3"
              >
                <p className="text-2xl">{b.emoji}</p>
                <p className="mt-1 text-[13px] font-semibold text-white">
                  {b.title}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {challenge.teamId && challenge.joined ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-0.5">
            <MessageCircle className="h-4 w-4 text-[var(--gym-gold)]" />
            <h2 className="text-[15px] font-semibold text-white">
              Czat wyzwania
            </h2>
          </div>
          <WorkoutChatPanel
            target={{
              kind: "challenge",
              challengeId: challenge.id,
              teamId: challenge.teamId,
              title: challenge.title,
            }}
            viewerUserId={viewerUserId}
            compact
          />
        </section>
      ) : null}
    </div>
  );
}
