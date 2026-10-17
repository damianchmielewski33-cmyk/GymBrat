"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  createChallengeAction,
  type ChallengeActionState,
} from "@/actions/challenges";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  challengeScopeLabel,
  type ChallengeTemplate,
} from "@/lib/community/challenge-types";

export function CreateChallengeForm({
  teamId,
  templates,
}: {
  teamId: string;
  templates: ChallengeTemplate[];
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, action, pending] = useActionState(
    createChallengeAction,
    {} as ChallengeActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok && state.challengeId) {
      notifySaved("Wyzwanie utworzone");
      router.push(
        `/community/teams/${teamId}/challenges/${state.challengeId}`,
      );
    }
  }, [state, notifyError, notifySaved, router, teamId]);

  const teamTemplates = templates.filter((t) => t.scope !== "global");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="teamId" value={teamId} />
      <p className="text-[13px] text-white/50">
        Wybierz szablon — postęp, leaderboard, XP i odznaki startują od razu.
      </p>
      <div className="space-y-2">
        {teamTemplates.map((t) => (
          <label
            key={t.key}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 has-[:checked]:border-[var(--gym-gold)]/50 has-[:checked]:bg-[var(--gym-gold)]/10"
          >
            <input
              type="radio"
              name="templateKey"
              value={t.key}
              defaultChecked={t.key === teamTemplates[0]?.key}
              className="mt-1.5"
            />
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-2xl">
              {t.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-white">
                {t.title}
              </span>
              <span className="mt-0.5 block text-[12px] text-white/45">
                {t.description}
              </span>
              <span className="mt-1.5 inline-flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
                <span>{challengeScopeLabel(t.scope)}</span>
                <span>·</span>
                <span>+{t.rewardXp} XP</span>
                <span>·</span>
                <span>{t.rewardTitle}</span>
              </span>
            </span>
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[var(--gym-gold)] text-[14px] font-bold text-black disabled:opacity-50"
      >
        {pending ? "Tworzenie…" : "Uruchom wyzwanie"}
      </button>
    </form>
  );
}
