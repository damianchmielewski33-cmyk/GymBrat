import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  teamMembers,
  teamQuestCompletions,
  teamQuestContributions,
  teamQuests,
  userBadges,
  users,
} from "@/db/schema";
import {
  computeWorkoutMetricDelta,
  type WorkoutMetricSource,
} from "@/lib/community/challenge-metrics";
import type { ChallengeMetricFilter } from "@/lib/community/challenge-types";
import {
  getQuestTemplate,
  TEAM_QUEST_TEMPLATES,
  type TeamQuestTemplate,
} from "@/lib/community/team-quest-types";

export function listQuestTemplates(): TeamQuestTemplate[] {
  return TEAM_QUEST_TEMPLATES;
}

export async function getActiveQuestForTeam(teamId: string) {
  await ensureCriticalSchema();
  const db = getDb();
  const [quest] = await db
    .select()
    .from(teamQuests)
    .where(and(eq(teamQuests.teamId, teamId), eq(teamQuests.status, "active")))
    .limit(1);
  return quest ?? null;
}

export async function startTeamQuest(input: {
  teamId: string;
  templateKey: string;
  createdBy: string;
}): Promise<{ ok: true; questId: string } | { ok: false; error: string }> {
  await ensureCriticalSchema();
  const template = getQuestTemplate(input.templateKey);
  if (!template) return { ok: false, error: "Nieznany szablon misji." };

  const active = await getActiveQuestForTeam(input.teamId);
  if (active) return { ok: false, error: "Masz już aktywną misję." };

  const db = getDb();
  const startsAt = new Date();
  const endsAt = new Date(
    startsAt.getTime() + template.durationDays * 86_400_000,
  );
  const id = crypto.randomUUID();
  await db.insert(teamQuests).values({
    id,
    teamId: input.teamId,
    templateKey: template.key,
    title: template.title,
    emoji: template.emoji,
    metricKind: template.metricKind,
    metricFilterJson: JSON.stringify(template.metricFilter),
    targetValue: template.targetValue,
    unitLabel: template.unitLabel,
    startsAt,
    endsAt,
    status: "active",
    rewardXpEach: template.rewardXpEach,
    rewardBadgeKey: template.rewardBadgeKey,
    rewardTitle: template.rewardTitle,
    createdBy: input.createdBy,
  });
  return { ok: true, questId: id };
}

export async function listQuestHistory(teamId: string, limit = 20) {
  await ensureCriticalSchema();
  const db = getDb();
  return db
    .select({
      id: teamQuestCompletions.id,
      questId: teamQuestCompletions.questId,
      completedAt: teamQuestCompletions.completedAt,
      totalValue: teamQuestCompletions.totalValue,
      participantsCount: teamQuestCompletions.participantsCount,
      title: teamQuests.title,
      emoji: teamQuests.emoji,
      rewardTitle: teamQuests.rewardTitle,
      unitLabel: teamQuests.unitLabel,
    })
    .from(teamQuestCompletions)
    .innerJoin(teamQuests, eq(teamQuestCompletions.questId, teamQuests.id))
    .where(eq(teamQuestCompletions.teamId, teamId))
    .orderBy(desc(teamQuestCompletions.completedAt))
    .limit(limit);
}

export type QuestContributor = {
  userId: string;
  displayName: string;
  amount: number;
};

export type QuestBoardView = {
  quest: typeof teamQuests.$inferSelect;
  total: number;
  pct: number;
  contributors: QuestContributor[];
  history: Awaited<ReturnType<typeof listQuestHistory>>;
};

export async function getQuestBoardView(
  teamId: string,
): Promise<QuestBoardView | null> {
  const quest = await getActiveQuestForTeam(teamId);
  const history = await listQuestHistory(teamId, 10);
  if (!quest) {
    return null;
  }
  await expireIfNeeded(quest.id, quest.endsAt);

  const db = getDb();
  const contribs = await db
    .select({
      userId: teamQuestContributions.userId,
      amount: teamQuestContributions.amount,
      name: users.name,
      email: users.email,
    })
    .from(teamQuestContributions)
    .innerJoin(users, eq(teamQuestContributions.userId, users.id))
    .where(eq(teamQuestContributions.questId, quest.id))
    .orderBy(desc(teamQuestContributions.amount));

  const total = contribs.reduce((s, c) => s + c.amount, 0);
  const pct = Math.min(
    100,
    Math.round((total / Math.max(1, quest.targetValue)) * 100),
  );

  return {
    quest,
    total,
    pct,
    contributors: contribs.map((c) => ({
      userId: c.userId,
      displayName: c.name?.trim() || c.email?.split("@")[0] || "Athlete",
      amount: c.amount,
    })),
    history,
  };
}

async function expireIfNeeded(questId: string, endsAt: Date) {
  if (Date.now() < endsAt.getTime()) return;
  const db = getDb();
  await db
    .update(teamQuests)
    .set({ status: "expired" })
    .where(and(eq(teamQuests.id, questId), eq(teamQuests.status, "active")));
}

export async function applyQuestProgressAfterWorkout(input: {
  userId: string;
  teamIds: string[];
  workout: WorkoutMetricSource;
}): Promise<void> {
  if (input.teamIds.length === 0) return;
  await ensureCriticalSchema();
  const db = getDb();

  for (const teamId of input.teamIds) {
    const quest = await getActiveQuestForTeam(teamId);
    if (!quest) continue;
    if (quest.endsAt.getTime() < Date.now()) {
      await expireIfNeeded(quest.id, quest.endsAt);
      continue;
    }

    let filter: ChallengeMetricFilter = {};
    try {
      filter = JSON.parse(quest.metricFilterJson) as ChallengeMetricFilter;
    } catch {
      filter = {};
    }
    const delta = computeWorkoutMetricDelta(
      quest.metricKind as Parameters<typeof computeWorkoutMetricDelta>[0],
      filter,
      input.workout,
    );
    if (delta <= 0) continue;

    const [existing] = await db
      .select()
      .from(teamQuestContributions)
      .where(
        and(
          eq(teamQuestContributions.questId, quest.id),
          eq(teamQuestContributions.userId, input.userId),
        ),
      )
      .limit(1);

    if (existing?.lastWorkoutId === input.workout.workoutId) continue;

    if (existing) {
      await db
        .update(teamQuestContributions)
        .set({
          amount: existing.amount + delta,
          lastWorkoutId: input.workout.workoutId,
          updatedAt: new Date(),
        })
        .where(eq(teamQuestContributions.id, existing.id));
    } else {
      await db.insert(teamQuestContributions).values({
        questId: quest.id,
        userId: input.userId,
        amount: delta,
        lastWorkoutId: input.workout.workoutId,
      });
    }

    await tryCompleteQuest(quest.id);
  }
}

async function tryCompleteQuest(questId: string): Promise<void> {
  const db = getDb();
  const [quest] = await db
    .select()
    .from(teamQuests)
    .where(and(eq(teamQuests.id, questId), eq(teamQuests.status, "active")))
    .limit(1);
  if (!quest) return;

  const [sumRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${teamQuestContributions.amount}), 0)`,
    })
    .from(teamQuestContributions)
    .where(eq(teamQuestContributions.questId, questId));

  const total = Number(sumRow?.total ?? 0);
  if (total < quest.targetValue) return;

  const contribs = await db
    .select()
    .from(teamQuestContributions)
    .where(eq(teamQuestContributions.questId, questId));

  const activeContribs = contribs.filter((c) => c.amount > 0);

  await db
    .update(teamQuests)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(teamQuests.id, questId));

  try {
    await db.insert(teamQuestCompletions).values({
      questId,
      teamId: quest.teamId,
      totalValue: total,
      participantsCount: activeContribs.length,
      metaJson: JSON.stringify({ templateKey: quest.templateKey }),
    });
  } catch {
    return;
  }

  const { awardProgressionXp } = await import("@/lib/community/progression");
  for (const c of activeContribs) {
    const badgeKey = `quest_${quest.templateKey}_${questId}`;
    try {
      await db.insert(userBadges).values({
        userId: c.userId,
        badgeKey,
        title: quest.rewardTitle,
        emoji: quest.emoji,
      });
    } catch {
      /* */
    }
    await awardProgressionXp({
      userId: c.userId,
      teamId: quest.teamId,
      amount: quest.rewardXpEach,
      source: "team_quest",
      sourceKey: `quest_complete:${questId}:${c.userId}`,
    });
  }

  try {
    const { notifyTeamMembers } = await import("@/lib/community/notifications");
    await notifyTeamMembers({
      teamId: quest.teamId,
      kind: "achievement",
      title: "Misja ukończona!",
      body: `${quest.emoji} ${quest.title} — wspólna odznaka dla aktywnych.`,
      href: `/community/teams/${quest.teamId}/quests`,
      groupKey: `quest:done:${questId}`,
      entityType: "quest",
      entityId: questId,
    });
  } catch {
    /* */
  }
}

export async function getMemberTeamIds(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return rows.map((r) => r.teamId);
}
