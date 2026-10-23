"use server";

import { guardAction } from "@/lib/action-guard";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { teamMembers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cancelWarQueue, queueForWar } from "@/lib/community/team-wars";

async function assertMember(userId: string, teamId: string) {
  const db = getDb();
  const [row] = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function queueWarAction(teamId: string) {
  await guardAction("community-wars.queueWarAction");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false as const, error: "Zaloguj się." };
  if (!(await assertMember(userId, teamId))) {
    return { ok: false as const, error: "Nie jesteś w tej grupie." };
  }
  return queueForWar(teamId);
}

export async function cancelWarQueueAction(teamId: string) {
  await guardAction("community-wars.cancelWarQueueAction");
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  if (!(await assertMember(userId, teamId))) return;
  await cancelWarQueue(teamId);
}
