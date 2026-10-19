import { and, desc, eq, gte, inArray, like, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  challengeRewardClaims,
  hofAwards,
  hofSeasons,
  userBadges,
  userReputationEvents,
  users,
  workouts,
} from "@/db/schema";
import { volumeFromExercisesJson } from "@/lib/community/fcs-compute";
import {
  previousPeriod,
  resolvePeriod,
  type HofPeriodBounds,
} from "@/lib/community/hof-periods";
import {
  communityHeroScore,
  formatProgressLabel,
  maxConsecutiveWeeks,
  relativeProgressScore,
  teamLegendScore,
  topN,
} from "@/lib/community/hof-score";
import {
  HOF_CATEGORIES,
  HOF_CATEGORY_META,
  type HofCategory,
  type HofCategoryBoard,
  type HofLeader,
  type HofPeriodKind,
} from "@/lib/community/hof-types";
import { weekDateKeysMondayFirst } from "@/lib/local-date";

async function displayNames(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(inArray(users.id, userIds));
  for (const r of rows) {
    map.set(r.id, r.name?.trim() || r.email?.split("@")[0] || "Athlete");
  }
  return map;
}

export async function ensureHofSeason(
  period: HofPeriodBounds,
): Promise<void> {
  await ensureCriticalSchema();
  const db = getDb();
  const existing = await db
    .select()
    .from(hofSeasons)
    .where(eq(hofSeasons.key, period.key))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (existing) {
    if (period.isClosed && existing.status === "open") {
      await db
        .update(hofSeasons)
        .set({
          status: "archived",
          archivedAt: new Date(),
        })
        .where(eq(hofSeasons.key, period.key));
    }
    return;
  }
  await db.insert(hofSeasons).values({
    key: period.key,
    kind: period.kind,
    title: period.title,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    status: period.isClosed ? "archived" : "open",
    archivedAt: period.isClosed ? new Date() : null,
  });
}

type Scored = { userId: string; score: number; scoreLabel: string };

async function scoreMostProgress(period: HofPeriodBounds): Promise<Scored[]> {
  const db = getDb();
  const prev = previousPeriod(period.kind, period.startsAt);
  const rows = await db
    .select({
      userId: workouts.userId,
      exercises: workouts.exercises,
      date: workouts.date,
    })
    .from(workouts)
    .where(
      and(
        gte(workouts.date, period.startsAt.toISOString().slice(0, 10)),
        lt(
          workouts.date,
          period.endsAt.toISOString().slice(0, 10) === "2099-01-01"
            ? "9999-12-31"
            : period.endsAt.toISOString().slice(0, 10),
        ),
      ),
    );

  const nowVol = new Map<string, number>();
  for (const r of rows) {
    nowVol.set(
      r.userId,
      (nowVol.get(r.userId) ?? 0) + volumeFromExercisesJson(r.exercises),
    );
  }

  const prevVol = new Map<string, number>();
  if (prev) {
    const prevRows = await db
      .select({
        userId: workouts.userId,
        exercises: workouts.exercises,
      })
      .from(workouts)
      .where(
        and(
          gte(workouts.date, prev.startsAt.toISOString().slice(0, 10)),
          lt(workouts.date, prev.endsAt.toISOString().slice(0, 10)),
        ),
      );
    for (const r of prevRows) {
      prevVol.set(
        r.userId,
        (prevVol.get(r.userId) ?? 0) + volumeFromExercisesJson(r.exercises),
      );
    }
  }

  const out: Scored[] = [];
  for (const [userId, vol] of nowVol) {
    const ratio = relativeProgressScore(vol, prevVol.get(userId) ?? 0);
    if (ratio === 0 && vol === 0) continue;
    out.push({
      userId,
      score: ratio,
      scoreLabel: formatProgressLabel(ratio),
    });
  }
  return out;
}

async function scoreLongestStreak(period: HofPeriodBounds): Promise<Scored[]> {
  const db = getDb();
  const startKey = period.startsAt.toISOString().slice(0, 10);
  const endKey =
    period.kind === "all_time"
      ? "9999-12-31"
      : period.endsAt.toISOString().slice(0, 10);
  const rows = await db
    .select({ userId: workouts.userId, date: workouts.date })
    .from(workouts)
    .where(and(gte(workouts.date, startKey), lt(workouts.date, endKey)));

  const byUser = new Map<string, string[]>();
  for (const r of rows) {
    const monday = weekDateKeysMondayFirst(r.date)[0]!;
    const list = byUser.get(r.userId) ?? [];
    list.push(monday);
    byUser.set(r.userId, list);
  }

  const out: Scored[] = [];
  for (const [userId, weeks] of byUser) {
    const streak = maxConsecutiveWeeks(weeks);
    if (streak <= 0) continue;
    out.push({
      userId,
      score: streak,
      scoreLabel: `${streak} tyg.`,
    });
  }
  return out;
}

async function scoreMostHelpful(period: HofPeriodBounds): Promise<Scored[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: userReputationEvents.userId,
      points: userReputationEvents.points,
      kind: userReputationEvents.kind,
    })
    .from(userReputationEvents)
    .where(
      and(
        gte(userReputationEvents.createdAt, period.startsAt),
        lt(userReputationEvents.createdAt, period.endsAt),
        sql`${userReputationEvents.kind} in ('help_reaction','help_comment')`,
      ),
    );
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.userId, (map.get(r.userId) ?? 0) + r.points);
  }
  return [...map.entries()].map(([userId, score]) => ({
    userId,
    score,
    scoreLabel: `${score} RP pomocy`,
  }));
}

async function scoreChallengeMaster(
  period: HofPeriodBounds,
): Promise<Scored[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: challengeRewardClaims.userId,
      xp: challengeRewardClaims.xpAwarded,
    })
    .from(challengeRewardClaims)
    .where(
      and(
        gte(challengeRewardClaims.claimedAt, period.startsAt),
        lt(challengeRewardClaims.claimedAt, period.endsAt),
      ),
    );
  const counts = new Map<string, { n: number; xp: number }>();
  for (const r of rows) {
    const cur = counts.get(r.userId) ?? { n: 0, xp: 0 };
    cur.n += 1;
    cur.xp += r.xp ?? 0;
    counts.set(r.userId, cur);
  }
  return [...counts.entries()].map(([userId, v]) => ({
    userId,
    score: v.n * 1000 + v.xp,
    scoreLabel: `${v.n} wyzwań`,
  }));
}

async function scoreWorkoutBeast(period: HofPeriodBounds): Promise<Scored[]> {
  const db = getDb();
  const startKey = period.startsAt.toISOString().slice(0, 10);
  const endKey =
    period.kind === "all_time"
      ? "9999-12-31"
      : period.endsAt.toISOString().slice(0, 10);
  const rows = await db
    .select({
      userId: workouts.userId,
      exercises: workouts.exercises,
    })
    .from(workouts)
    .where(and(gte(workouts.date, startKey), lt(workouts.date, endKey)));
  const map = new Map<string, { n: number; vol: number }>();
  for (const r of rows) {
    const cur = map.get(r.userId) ?? { n: 0, vol: 0 };
    cur.n += 1;
    cur.vol += volumeFromExercisesJson(r.exercises);
    map.set(r.userId, cur);
  }
  return [...map.entries()].map(([userId, v]) => ({
    userId,
    score: v.n * 1_000_000 + v.vol,
    scoreLabel: `${v.n} sesji`,
  }));
}

async function scoreCommunityHero(period: HofPeriodBounds): Promise<Scored[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: userReputationEvents.userId,
      points: userReputationEvents.points,
      kind: userReputationEvents.kind,
    })
    .from(userReputationEvents)
    .where(
      and(
        gte(userReputationEvents.createdAt, period.startsAt),
        lt(userReputationEvents.createdAt, period.endsAt),
      ),
    );
  const map = new Map<string, { rp: number; kinds: Set<string> }>();
  for (const r of rows) {
    const cur = map.get(r.userId) ?? { rp: 0, kinds: new Set<string>() };
    cur.rp += r.points;
    cur.kinds.add(r.kind);
    map.set(r.userId, cur);
  }
  return [...map.entries()].map(([userId, v]) => ({
    userId,
    score: communityHeroScore(v.rp, v.kinds.size),
    scoreLabel: `${v.rp} RP`,
  }));
}

async function scoreTeamLegend(period: HofPeriodBounds): Promise<Scored[]> {
  const db = getDb();
  const rows = await db
    .select({
      userId: userReputationEvents.userId,
      points: userReputationEvents.points,
      kind: userReputationEvents.kind,
      teamId: userReputationEvents.teamId,
    })
    .from(userReputationEvents)
    .where(
      and(
        gte(userReputationEvents.createdAt, period.startsAt),
        lt(userReputationEvents.createdAt, period.endsAt),
      ),
    );
  const map = new Map<
    string,
    {
      teamRp: number;
      live: number;
      challenge: number;
      teams: Set<string>;
    }
  >();
  for (const r of rows) {
    const cur = map.get(r.userId) ?? {
      teamRp: 0,
      live: 0,
      challenge: 0,
      teams: new Set<string>(),
    };
    if (r.teamId) {
      cur.teamRp += r.points;
      cur.teams.add(r.teamId);
    }
    if (r.kind === "live_join") cur.live += 1;
    if (r.kind === "challenge") cur.challenge += 1;
    map.set(r.userId, cur);
  }
  return [...map.entries()].map(([userId, v]) => ({
    userId,
    score: teamLegendScore({
      teamScopedRp: v.teamRp,
      liveJoins: v.live,
      challengeClaims: v.challenge,
      distinctTeams: v.teams.size,
    }),
    scoreLabel: `${v.teams.size} grup`,
  }));
}

const SCORERS: Record<
  HofCategory,
  (p: HofPeriodBounds) => Promise<Scored[]>
> = {
  most_progress: scoreMostProgress,
  longest_streak: scoreLongestStreak,
  most_helpful: scoreMostHelpful,
  challenge_master: scoreChallengeMaster,
  workout_beast: scoreWorkoutBeast,
  community_hero: scoreCommunityHero,
  team_legend: scoreTeamLegend,
};

export async function computeLiveLeaders(
  period: HofPeriodBounds,
): Promise<HofCategoryBoard[]> {
  const boards: HofCategoryBoard[] = [];
  for (const category of HOF_CATEGORIES) {
    const scored = await SCORERS[category](period);
    const top = topN(scored, 3) as Array<Scored & { rank: number }>;
    const names = await displayNames(top.map((t) => t.userId));
    const leaders: HofLeader[] = top.map((t) => ({
      userId: t.userId,
      displayName: names.get(t.userId) ?? "Athlete",
      rank: t.rank,
      score: t.score,
      scoreLabel: t.scoreLabel,
    }));
    const meta = HOF_CATEGORY_META[category];
    boards.push({
      category,
      label: meta.label,
      emoji: meta.emoji,
      leaders,
    });
  }
  return boards;
}

async function loadAwards(
  seasonKey: string,
): Promise<HofCategoryBoard[] | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(hofAwards)
    .where(eq(hofAwards.seasonKey, seasonKey));
  if (rows.length === 0) return null;
  const names = await displayNames(rows.map((r) => r.userId));
  return HOF_CATEGORIES.map((category) => {
    const meta = HOF_CATEGORY_META[category];
    const leaders = rows
      .filter((r) => r.category === category)
      .sort((a, b) => a.rank - b.rank)
      .map((r) => ({
        userId: r.userId,
        displayName: names.get(r.userId) ?? "Athlete",
        rank: r.rank,
        score: r.score,
        scoreLabel: r.scoreLabel,
      }));
    return {
      category,
      label: meta.label,
      emoji: meta.emoji,
      leaders,
    };
  });
}

export async function finalizeSeasonIfDue(
  period: HofPeriodBounds,
): Promise<boolean> {
  if (!period.isClosed || period.kind === "all_time") return false;
  await ensureHofSeason(period);
  const existing = await loadAwards(period.key);
  if (existing) return false;

  const boards = await computeLiveLeaders(period);
  const db = getDb();
  for (const board of boards) {
    for (const leader of board.leaders) {
      try {
        await db.insert(hofAwards).values({
          seasonKey: period.key,
          category: board.category,
          rank: leader.rank,
          userId: leader.userId,
          score: leader.score,
          scoreLabel: leader.scoreLabel,
          metaJson: "{}",
        });
      } catch {
        /* unique race */
      }
      if (leader.rank === 1) {
        const badgeKey = `hof_${period.key}_${board.category}`;
        try {
          await db.insert(userBadges).values({
            userId: leader.userId,
            badgeKey,
            title: `${board.label} · ${period.title}`,
            emoji: board.emoji,
          });
        } catch {
          /* already */
        }
        try {
          const { notifyHallOfFameWin } = await import(
            "@/lib/community/notifications"
          );
          await notifyHallOfFameWin({
            userId: leader.userId,
            seasonKey: period.key,
            categoryLabel: board.label,
          });
        } catch {
          /* notify optional */
        }
      }
    }
  }
  await db
    .update(hofSeasons)
    .set({ status: "archived", archivedAt: new Date() })
    .where(eq(hofSeasons.key, period.key));
  return true;
}

export async function listHofArchive(limit = 12) {
  await ensureCriticalSchema();
  const db = getDb();
  return db
    .select()
    .from(hofSeasons)
    .where(eq(hofSeasons.status, "archived"))
    .orderBy(desc(hofSeasons.endsAt))
    .limit(limit);
}

export async function listCategoryHistory(
  category: HofCategory,
  limit = 8,
): Promise<
  Array<{
    seasonKey: string;
    title: string;
    displayName: string;
    scoreLabel: string;
    awardedAt: Date;
  }>
> {
  await ensureCriticalSchema();
  const db = getDb();
  const rows = await db
    .select({
      seasonKey: hofAwards.seasonKey,
      scoreLabel: hofAwards.scoreLabel,
      awardedAt: hofAwards.awardedAt,
      userId: hofAwards.userId,
      title: hofSeasons.title,
    })
    .from(hofAwards)
    .innerJoin(hofSeasons, eq(hofAwards.seasonKey, hofSeasons.key))
    .where(and(eq(hofAwards.category, category), eq(hofAwards.rank, 1)))
    .orderBy(desc(hofAwards.awardedAt))
    .limit(limit);
  const names = await displayNames(rows.map((r) => r.userId));
  return rows.map((r) => ({
    seasonKey: r.seasonKey,
    title: r.title,
    displayName: names.get(r.userId) ?? "Athlete",
    scoreLabel: r.scoreLabel,
    awardedAt: r.awardedAt,
  }));
}

export type HofPageData = {
  period: HofPeriodBounds;
  boards: HofCategoryBoard[];
  archived: boolean;
  archive: Awaited<ReturnType<typeof listHofArchive>>;
  historyByCategory: Partial<
    Record<HofCategory, Awaited<ReturnType<typeof listCategoryHistory>>>
  >;
  viewerBadges: Array<{ badgeKey: string; title: string; emoji: string }>;
};

export async function getHofPageData(
  kind: HofPeriodKind,
  viewerUserId: string,
): Promise<HofPageData> {
  await ensureCriticalSchema();
  const period = resolvePeriod(kind);
  await ensureHofSeason(period);
  await finalizeSeasonIfDue(period);

  let boards = await loadAwards(period.key);
  const archived = Boolean(boards);
  if (!boards) {
    boards = await computeLiveLeaders(period);
  }

  const archive = await listHofArchive();
  const historyByCategory: HofPageData["historyByCategory"] = {};
  for (const cat of HOF_CATEGORIES) {
    historyByCategory[cat] = await listCategoryHistory(cat, 5);
  }

  const db = getDb();
  const badges = await db
    .select({
      badgeKey: userBadges.badgeKey,
      title: userBadges.title,
      emoji: userBadges.emoji,
    })
    .from(userBadges)
    .where(
      and(eq(userBadges.userId, viewerUserId), like(userBadges.badgeKey, "hof_%")),
    );

  return {
    period,
    boards,
    archived,
    archive,
    historyByCategory,
    viewerBadges: badges,
  };
}
