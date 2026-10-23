"use server";

import { guardAction } from "@/lib/action-guard";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { teamMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { startTeamQuest } from "@/lib/community/team-quests";

export async function startTeamQuestAction(
  teamId: string,
  templateKey: string,
) {
  await guardAction("community-quests.startTeamQuestAction");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Zaloguj się." };
  const db = getDb();
  const [m] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  if (!m) return { ok: false as const, error: "Brak dostępu." };
  if (!["owner", "admin", "moderator"].includes(m.role)) {
    return { ok: false as const, error: "Tylko owner/admin/moderator." };
  }
  return startTeamQuest({ teamId, templateKey, createdBy: userId });
}
