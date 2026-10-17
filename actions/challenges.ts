"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  createChallengeFromTemplate,
  joinChallenge,
  markCelebrationSeen,
} from "@/lib/community/challenges";
import { isChallengeScope } from "@/lib/community/challenge-types";
import { UserMessages } from "@/lib/user-facing-errors";

export type ChallengeActionState = {
  ok?: boolean;
  error?: string;
  challengeId?: string;
};

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }
  return { ok: true as const, userId: session.user.id };
}

function revalidateChallenges(teamId?: string | null, challengeId?: string) {
  revalidatePath("/community/challenges");
  revalidatePath("/community/teams");
  if (teamId) {
    revalidatePath(`/community/teams/${teamId}`);
    revalidatePath(`/community/teams/${teamId}/challenges`);
  }
  if (challengeId) {
    revalidatePath(`/community/challenges/${challengeId}`);
    if (teamId) {
      revalidatePath(`/community/teams/${teamId}/challenges/${challengeId}`);
    }
  }
}

export async function createChallengeAction(
  _prev: ChallengeActionState,
  formData: FormData,
): Promise<ChallengeActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const teamId = String(formData.get("teamId") ?? "") || null;
  const templateKey = String(formData.get("templateKey") ?? "");
  const scopeRaw = String(formData.get("scope") ?? "");
  const scopeOverride = isChallengeScope(scopeRaw) ? scopeRaw : undefined;

  const result = await createChallengeFromTemplate({
    actorUserId: user.userId,
    teamId,
    templateKey,
    scopeOverride,
  });
  if (!result.ok) return { error: result.error };
  revalidateChallenges(teamId, result.challengeId);
  return { ok: true, challengeId: result.challengeId };
}

export async function joinChallengeAction(
  _prev: ChallengeActionState,
  formData: FormData,
): Promise<ChallengeActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const challengeId = String(formData.get("challengeId") ?? "");
  const teamId = String(formData.get("teamId") ?? "") || null;
  const result = await joinChallenge({
    challengeId,
    userId: user.userId,
  });
  if (!result.ok) return { error: result.error };
  revalidateChallenges(teamId, challengeId);
  return { ok: true, challengeId };
}

export async function markCelebrationSeenAction(
  claimId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!user.ok) return { ok: false, error: user.error };
  const result = await markCelebrationSeen({
    userId: user.userId,
    claimId,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
