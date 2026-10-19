/**
 * Zbieranie danych + zapis cache FCS dla rankingu teamu.
 */

import { and, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import { getDb } from "@/db";
import {
  challengeParticipants,
  challengeProgress,
  challenges,
  groupWorkoutParticipants,
  groupWorkoutSessions,
  teamFcsScores,
  teamMembers,
  teamPostComments,
  teamPostReactions,
  teamPosts,
  userSettings,
  users,
  workouts,
} from "@/db/schema";
import {
  addCalendarDays,
  calendarDateKey,
  weekDateKeysMondayFirst,
} from "@/lib/local-date";
import { parseFitnessGoalsJson } from "@/lib/fitness-goals";
import {
  capEvents,
  computeFcs,
  type FcsBreakdown,
  type FcsComponents,
} from "@/lib/community/fcs";
import { cacheGet, cacheSet } from "@/lib/community/perf-cache";

const CACHE_TTL_MS = 45_000;
const NEWCOMER_DAYS = 21;

export type FcsRankingRow = {
  userId: string;
  displayName: string;
  score: number;
  rank: number;
  metric: "fcs";
  components: FcsComponents;
  newcomerBoost: number;
};

function mondayOf(dateKey: string): string {
  return weekDateKeysMondayFirst(dateKey)[0]!;
}

function displayNameFromUser(row: {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  email: string;
}): string {
  const full = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  if (full) return full;
  if (row.name?.trim()) return row.name.trim();
  return row.email.split("@")[0] || "Zawodnik";
}

/** Suma objętości (weight×reps) z JSON ćwiczeń — bez cardio_log. */
export function volumeFromExercisesJson(raw: string | null | undefined): number {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as { kind?: string; exercises?: unknown[] };
      if (obj.kind === "cardio_log") return 0;
    }
    const list = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { exercises?: unknown[] }).exercises)
        ? (parsed as { exercises: unknown[] }).exercises
        : [];
    let tonnage = 0;
    for (const ex of list) {
      if (!ex || typeof ex !== "object") continue;
      const sets = (ex as { sets?: unknown[] }).sets;
      if (!Array.isArray(sets)) continue;
      for (const set of sets) {
        if (!set || typeof set !== "object") continue;
        const s = set as {
          completed?: boolean;
          skipped?: boolean;
          done?: boolean;
          weight?: number;
          reps?: number;
        };
        if (s.skipped || s.completed === false) continue;
        if (s.done === false) continue;
        const weight = Number(s.weight) || 0;
        const reps = Number(s.reps) || 0;
        if (weight > 0 && reps > 0) tonnage += weight * reps;
      }
    }
    return tonnage;
  } catch {
    return 0;
  }
}

function streakWeeksFromDates(
  datesDescUnique: string[],
  thisMonday: string,
): number {
  const set = new Set(datesDescUnique.map((d) => mondayOf(d)));
  let streak = 0;
  let cursor = thisMonday;
  for (let i = 0; i < 52; i++) {
    if (!set.has(cursor)) break;
    streak += 1;
    cursor = addCalendarDays(cursor, -7);
  }
  return streak;
}

export async function computeTeamFcsRanking(
  teamId: string,
  opts?: { force?: boolean },
): Promise<FcsRankingRow[]> {
  const today = calendarDateKey();
  const weekStart = mondayOf(today);
  const weekEnd = addCalendarDays(weekStart, 6);
  const prevStart = addCalendarDays(weekStart, -7);
  const prevEnd = addCalendarDays(prevStart, 6);
  const cacheKey = `fcs:rank:${teamId}:${weekStart}`;

  if (!opts?.force) {
    const cached = cacheGet<FcsRankingRow[]>(cacheKey);
    if (cached) return cached;
  }

  const db = getDb();
  const members = await db
    .select({
      userId: teamMembers.userId,
      joinedAt: teamMembers.joinedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.status, "active")),
    );

  if (members.length === 0) return [];

  const userIds = members.map((m) => m.userId);
  const historyFrom = addCalendarDays(weekStart, -7 * 12);

  const [
    workoutRows,
    settingsRows,
    posts,
    comments,
    reactions,
    liveJoins,
    challengeRows,
    progressRows,
  ] = await Promise.all([
    db
      .select({
        userId: workouts.userId,
        date: workouts.date,
        exercises: workouts.exercises,
      })
      .from(workouts)
      .where(
        and(
          inArray(workouts.userId, userIds),
          gte(workouts.date, historyFrom),
          lt(workouts.date, addCalendarDays(weekEnd, 1)),
        ),
      ),
    db
      .select({
        userId: userSettings.userId,
        fitnessGoalsJson: userSettings.fitnessGoalsJson,
      })
      .from(userSettings)
      .where(inArray(userSettings.userId, userIds)),
    db
      .select({
        id: teamPosts.id,
        authorUserId: teamPosts.authorUserId,
        createdAt: teamPosts.createdAt,
      })
      .from(teamPosts)
      .where(
        and(
          eq(teamPosts.teamId, teamId),
          isNull(teamPosts.deletedAt),
          gte(teamPosts.createdAt, new Date(`${weekStart}T00:00:00`)),
        ),
      ),
    db
      .select({
        id: teamPostComments.id,
        authorUserId: teamPostComments.authorUserId,
        postId: teamPostComments.postId,
        createdAt: teamPostComments.createdAt,
      })
      .from(teamPostComments)
      .innerJoin(teamPosts, eq(teamPosts.id, teamPostComments.postId))
      .where(
        and(
          eq(teamPosts.teamId, teamId),
          isNull(teamPosts.deletedAt),
          isNull(teamPostComments.deletedAt),
          gte(teamPostComments.createdAt, new Date(`${weekStart}T00:00:00`)),
        ),
      ),
    db
      .select({
        userId: teamPostReactions.userId,
        postId: teamPostReactions.postId,
        createdAt: teamPostReactions.createdAt,
      })
      .from(teamPostReactions)
      .innerJoin(teamPosts, eq(teamPosts.id, teamPostReactions.postId))
      .where(
        and(
          eq(teamPosts.teamId, teamId),
          gte(teamPostReactions.createdAt, new Date(`${weekStart}T00:00:00`)),
        ),
      ),
    db
      .select({
        userId: groupWorkoutParticipants.userId,
        joinedAt: groupWorkoutParticipants.joinedAt,
      })
      .from(groupWorkoutParticipants)
      .innerJoin(
        groupWorkoutSessions,
        eq(groupWorkoutSessions.id, groupWorkoutParticipants.sessionId),
      )
      .where(
        and(
          eq(groupWorkoutSessions.teamId, teamId),
          gte(
            groupWorkoutParticipants.joinedAt,
            new Date(`${weekStart}T00:00:00`),
          ),
        ),
      ),
    db
      .select({
        challengeId: challenges.id,
        userId: challengeParticipants.userId,
        status: challengeParticipants.status,
      })
      .from(challengeParticipants)
      .innerJoin(challenges, eq(challenges.id, challengeParticipants.challengeId))
      .where(
        and(
          eq(challenges.teamId, teamId),
          inArray(challengeParticipants.userId, userIds),
          ne(challenges.status, "cancelled"),
        ),
      ),
    db
      .select({
        challengeId: challengeProgress.challengeId,
        userId: challengeProgress.userId,
        currentValue: challengeProgress.currentValue,
        targetValue: challenges.targetValue,
      })
      .from(challengeProgress)
      .innerJoin(challenges, eq(challenges.id, challengeProgress.challengeId))
      .where(
        and(
          eq(challenges.teamId, teamId),
          inArray(challengeProgress.userId, userIds),
        ),
      ),
  ]);

  const targetByUser = new Map<string, number>();
  for (const s of settingsRows) {
    const goals = parseFitnessGoalsJson(s.fitnessGoalsJson);
    targetByUser.set(s.userId, goals.weeklySessionsTarget ?? 4);
  }

  const postAuthorById = new Map(posts.map((p) => [p.id, p.authorUserId]));

  type Acc = {
    dates: string[];
    sessionsThis: number;
    volThis: number;
    volPrev: number;
    social: number;
    help: number;
    live: number;
  };
  const acc = new Map<string, Acc>();
  for (const id of userIds) {
    acc.set(id, {
      dates: [],
      sessionsThis: 0,
      volThis: 0,
      volPrev: 0,
      social: 0,
      help: 0,
      live: 0,
    });
  }

  for (const w of workoutRows) {
    const a = acc.get(w.userId);
    if (!a) continue;
    a.dates.push(w.date);
    const vol = volumeFromExercisesJson(w.exercises);
    if (w.date >= weekStart && w.date <= weekEnd) {
      a.sessionsThis += 1;
      a.volThis += vol;
    } else if (w.date >= prevStart && w.date <= prevEnd) {
      a.volPrev += vol;
    }
  }

  for (const p of posts) {
    const a = acc.get(p.authorUserId);
    if (a) a.social += 1;
  }
  for (const c of comments) {
    const a = acc.get(c.authorUserId);
    if (!a) continue;
    a.social += 1;
    const postAuthor = postAuthorById.get(c.postId);
    if (postAuthor && postAuthor !== c.authorUserId) a.help += 1;
  }
  for (const r of reactions) {
    const a = acc.get(r.userId);
    if (!a) continue;
    a.social += 1;
    const postAuthor = postAuthorById.get(r.postId);
    if (postAuthor && postAuthor !== r.userId) a.help += 1;
  }
  for (const l of liveJoins) {
    const a = acc.get(l.userId);
    if (a) a.live += 1;
  }

  const challengeJoined = new Set<string>();
  const challengeProg = new Map<string, number[]>();
  for (const row of challengeRows) {
    if (row.status === "active" || row.status === "completed") {
      challengeJoined.add(row.userId);
    }
  }
  for (const row of progressRows) {
    const target = Number(row.targetValue) || 0;
    const cur = Number(row.currentValue) || 0;
    const ratio = target > 0 ? Math.min(1, cur / target) : 0;
    const arr = challengeProg.get(row.userId) ?? [];
    arr.push(ratio);
    challengeProg.set(row.userId, arr);
  }

  const now = Date.now();
  const rows: Array<{
    userId: string;
    displayName: string;
    breakdown: FcsBreakdown;
  }> = [];

  for (const m of members) {
    const a = acc.get(m.userId)!;
    const weekDates = [
      ...new Set(a.dates.filter((d) => d >= weekStart && d <= weekEnd)),
    ];
    const allDatesDesc = [...new Set(a.dates)].sort((x, y) =>
      y.localeCompare(x),
    );
    const sessionsThisWeek = a.sessionsThis;
    const joinedMs = m.joinedAt?.getTime?.() ?? 0;
    const createdMs = m.createdAt?.getTime?.() ?? 0;
    const ageDays = Math.min(
      joinedMs > 0 ? (now - joinedMs) / 86_400_000 : 999,
      createdMs > 0 ? (now - createdMs) / 86_400_000 : 999,
    );
    const progArr = challengeProg.get(m.userId) ?? [];
    const challengeProgressAvg =
      progArr.length > 0
        ? progArr.reduce((s, v) => s + v, 0) / progArr.length
        : 0;

    const breakdown = computeFcs({
      sessionsThisWeek,
      uniqueDaysThisWeek: weekDates.length,
      weeklyTarget: targetByUser.get(m.userId) ?? 4,
      volumeThisWeek: a.volThis,
      volumePrevWeek: a.volPrev,
      streakWeeks: streakWeeksFromDates(allDatesDesc, weekStart),
      challengeProgressAvg,
      challengeJoined: challengeJoined.has(m.userId),
      socialEvents: capEvents(a.social),
      helpEvents: capEvents(a.help),
      liveSessionsJoined: a.live,
      isNewcomer: ageDays < NEWCOMER_DAYS,
    });

    rows.push({
      userId: m.userId,
      displayName: displayNameFromUser(m),
      breakdown,
    });
  }

  const ranked: FcsRankingRow[] = rows
    .map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      score: r.breakdown.fcs,
      rank: 0,
      metric: "fcs" as const,
      components: r.breakdown.components,
      newcomerBoost: r.breakdown.newcomerBoost,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.components.regularity - a.components.regularity ||
        a.displayName.localeCompare(b.displayName),
    )
    .map((row, i) => ({ ...row, rank: i + 1 }));

  // Persist cache rows (best-effort)
  try {
    const computedAt = new Date();
    for (const row of ranked) {
      const id = crypto.randomUUID();
      await db
        .insert(teamFcsScores)
        .values({
          id,
          teamId,
          userId: row.userId,
          weekStart,
          fcs: row.score,
          componentsJson: JSON.stringify({
            ...row.components,
            newcomerBoost: row.newcomerBoost,
          }),
          computedAt,
        })
        .onConflictDoUpdate({
          target: [
            teamFcsScores.teamId,
            teamFcsScores.userId,
            teamFcsScores.weekStart,
          ],
          set: {
            fcs: row.score,
            componentsJson: JSON.stringify({
              ...row.components,
              newcomerBoost: row.newcomerBoost,
            }),
            computedAt,
          },
        });
    }
  } catch (e) {
    console.warn(
      "[fcs] cache write failed",
      e instanceof Error ? e.message : e,
    );
  }

  cacheSet(cacheKey, ranked, CACHE_TTL_MS);
  return ranked;
}
