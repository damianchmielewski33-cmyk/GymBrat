"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userConsents, users, userSocialProfiles } from "@/db/schema";
import { guardAction } from "@/lib/action-guard";
import {
  TEAM_RANKING_CONSENT_TEXT_VERSION,
  type ConsentSource,
} from "@/lib/consents-client";
import { isConsentSource } from "@/lib/consents";
import { UserMessages } from "@/lib/user-facing-errors";

export type TeamRankingConsentResult =
  | { ok: true }
  | { ok: false; error: string; needDisplayName?: boolean };

/**
 * Zapis C-T1 / C-T2 z hubu grupy (opt-in). Wymaga pseudonimu (LR-T7).
 */
export async function saveTeamRankingConsentAction(input: {
  teamId: string;
  teamRanking: boolean;
  teamCardio: boolean;
  source?: ConsentSource;
}): Promise<TeamRankingConsentResult> {
  await guardAction("teamRankingConsent.save");
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: UserMessages.sessionExpired };
  }
  const userId = session.user.id;
  const db = getDb();

  const [user] = await db
    .select({ name: users.name, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const hasDisplayName = Boolean(
    user?.name?.trim() || user?.firstName?.trim(),
  );
  if (input.teamRanking && !hasDisplayName) {
    return {
      ok: false,
      error: "Ustaw pseudonim w profilu, zanim dołączysz do rankingu.",
      needDisplayName: true,
    };
  }

  const ranking = Boolean(input.teamRanking);
  const cardio = ranking && Boolean(input.teamCardio);
  const source: ConsentSource = isConsentSource(input.source ?? "team_hub")
    ? (input.source ?? "team_hub")
    : "team_hub";
  const decidedAt = new Date();

  await db.insert(userConsents).values([
    {
      userId,
      type: "team_ranking",
      granted: ranking,
      textVersion: TEAM_RANKING_CONSENT_TEXT_VERSION,
      source,
      decidedAt,
    },
    {
      userId,
      type: "team_cardio",
      granted: cardio,
      textVersion: TEAM_RANKING_CONSENT_TEXT_VERSION,
      source,
      decidedAt,
    },
  ]);

  const [existing] = await db
    .select({ userId: userSocialProfiles.userId })
    .from(userSocialProfiles)
    .where(eq(userSocialProfiles.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(userSocialProfiles)
      .set({
        optedInToTeamRanking: ranking ? 1 : 0,
        optedInToTeamCardio: cardio ? 1 : 0,
        updatedAt: decidedAt,
      })
      .where(eq(userSocialProfiles.userId, userId));
  } else {
    await db.insert(userSocialProfiles).values({
      userId,
      visibility: "private",
      showStats: 0,
      showOnGlobal: 0,
      discoverable: 0,
      optedInToTeamRanking: ranking ? 1 : 0,
      optedInToTeamCardio: cardio ? 1 : 0,
      updatedAt: decidedAt,
    });
  }

  revalidatePath(`/community/teams/${input.teamId}`);
  revalidatePath(`/community/teams/${input.teamId}/badges`);
  revalidatePath("/community");
  return { ok: true };
}
