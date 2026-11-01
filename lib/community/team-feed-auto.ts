import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { communityMilestones, workouts } from "@/db/schema";
import { computeAchievements } from "@/lib/achievements";
import { estimated1RM } from "@/lib/workout-history";
import { publishAutoPostToUserTeams } from "@/lib/community/team-feed";
import type { WorkoutPlanComparePayload } from "@/lib/workout-plan-compare";

const LEVEL_THRESHOLDS = [1, 5, 10, 25, 50, 100, 150, 200, 300, 500];

type CompletedExercise = {
  name?: string;
  sets?: Array<{
    reps?: number | null;
    weight?: number;
    done?: boolean;
    skipped?: boolean;
  }>;
};

function parseExercises(json: string): CompletedExercise[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) return parsed as CompletedExercise[];
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { exercises?: unknown }).exercises)
    ) {
      return (parsed as { exercises: CompletedExercise[] }).exercises;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function sessionTonnageKg(exercises: CompletedExercise[]): number {
  let total = 0;
  for (const ex of exercises) {
    for (const set of ex.sets ?? []) {
      if (set.skipped || set.done === false) continue;
      const w = Number(set.weight) || 0;
      const r = Number(set.reps) || 0;
      if (w > 0 && r > 0) total += w * r;
    }
  }
  return total;
}

function weekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function computeStreakWeeks(dates: string[]): number {
  const weeks = new Set(
    dates.map((d) => weekKey(new Date(`${d}T12:00:00`))),
  );
  const sorted = [...weeks].sort().reverse();
  if (sorted.length === 0) return 0;
  let streak = 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i]!;
    const prev = sorted[i + 1]!;
    const [cy, cw] = cur.split("-W").map(Number);
    const [py, pw] = prev.split("-W").map(Number);
    const curIdx = (cy ?? 0) * 53 + (cw ?? 0);
    const prevIdx = (py ?? 0) * 53 + (pw ?? 0);
    if (curIdx - prevIdx === 1) streak += 1;
    else break;
  }
  return streak;
}

function levelFromSessions(count: number): number {
  let level = 0;
  for (const t of LEVEL_THRESHOLDS) {
    if (count >= t) level += 1;
    else break;
  }
  return Math.max(1, level);
}

async function tryClaimMilestone(
  userId: string,
  kind: string,
  milestoneKey: string,
  meta: Record<string, unknown>,
): Promise<boolean> {
  const db = getDb();
  try {
    await db.insert(communityMilestones).values({
      id: crypto.randomUUID(),
      userId,
      kind,
      milestoneKey,
      unlockedAt: new Date(),
      metaJson: JSON.stringify(meta),
    });
    return true;
  } catch (e) {
    if (/unique|constraint/i.test(String(e))) return false;
    throw e;
  }
}

function detectPrHits(
  currentJson: string,
  historyJsons: string[],
): Array<{ exerciseName: string; e1rm: number; weight: number }> {
  const current = parseExercises(currentJson);
  const bestPrev = new Map<string, number>();

  for (const json of historyJsons) {
    for (const ex of parseExercises(json)) {
      const name = (ex.name ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      let best = bestPrev.get(key) ?? 0;
      for (const set of ex.sets ?? []) {
        if (set.skipped || set.done === false) continue;
        const w = Number(set.weight) || 0;
        const r = Number(set.reps) || 0;
        if (w > 0 && r > 0) best = Math.max(best, estimated1RM(w, r));
      }
      bestPrev.set(key, best);
    }
  }

  const hits: Array<{ exerciseName: string; e1rm: number; weight: number }> = [];
  for (const ex of current) {
    const name = (ex.name ?? "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    let bestE1 = 0;
    let bestW = 0;
    for (const set of ex.sets ?? []) {
      if (set.skipped || set.done === false) continue;
      const w = Number(set.weight) || 0;
      const r = Number(set.reps) || 0;
      if (w > 0 && r > 0) {
        bestE1 = Math.max(bestE1, estimated1RM(w, r));
        bestW = Math.max(bestW, w);
      }
    }
    const prev = bestPrev.get(key) ?? 0;
    if (bestE1 > 0 && bestE1 > prev + 0.25) {
      hits.push({
        exerciseName: name,
        e1rm: Math.round(bestE1 * 10) / 10,
        weight: Math.round(bestW * 10) / 10,
      });
    }
  }
  return hits;
}

/**
 * Publikuje auto-posty Team Feed po zapisie treningu.
 * Nie rzuca na zewnątrz — błędy feedu nie mogą psuć complete workout.
 */
export async function publishTeamFeedAfterWorkout(input: {
  userId: string;
  workoutId: string;
  title: string;
  dateKey: string;
  cardioMinutes: number;
  exercisesJson: string;
  planCompare: WorkoutPlanComparePayload | null;
}): Promise<void> {
  try {
    await ensureCriticalSchema();
    const db = getDb();
    const exercises = parseExercises(input.exercisesJson);

    // Team Challenges — postęp / XP / odznaki (nie blokuje feedu)
    try {
      const { applyChallengeProgressAfterWorkout } = await import(
        "@/lib/community/challenges"
      );
      await applyChallengeProgressAfterWorkout({
        userId: input.userId,
        source: {
          workoutId: input.workoutId,
          exercisesJson: input.exercisesJson,
          cardioMinutes: input.cardioMinutes,
        },
      });
    } catch {
      /* ignore */
    }
    try {
      const {
        applyQuestProgressAfterWorkout,
        getMemberTeamIds,
      } = await import("@/lib/community/team-quests");
      const teamIds = await getMemberTeamIds(input.userId);
      await applyQuestProgressAfterWorkout({
        userId: input.userId,
        teamIds,
        workout: {
          workoutId: input.workoutId,
          exercisesJson: input.exercisesJson,
          cardioMinutes: input.cardioMinutes,
        },
      });
    } catch {
      /* ignore */
    }
    try {
      const { awardProgressionXp } = await import(
        "@/lib/community/progression"
      );
      await awardProgressionXp({
        userId: input.userId,
        amount: 15,
        source: "workout",
        sourceKey: `workout:${input.workoutId}`,
      });
    } catch {
      /* ignore */
    }
    try {
      const { emitActivity } = await import("@/lib/community/activity-feed");
      await emitActivity({
        userId: input.userId,
        kind: "workout",
        title: `Trening: ${input.title || "Sesja"}`,
        body: null,
        meta: { workoutId: input.workoutId },
      });
    } catch {
      /* ignore */
    }
    const tonnage = sessionTonnageKg(exercises);
    const setCount = exercises.reduce(
      (n, ex) =>
        n +
        (ex.sets ?? []).filter((s) => !s.skipped && s.done !== false && (s.reps ?? 0) > 0)
          .length,
      0,
    );

    // LR-T10: auto-posty z wynikiem tylko przy aktywnej zgodzie C-T1.
    const { hasGrantedConsent } = await import("@/lib/consents");
    const canAutoPost = await hasGrantedConsent(input.userId, "team_ranking");
    if (!canAutoPost) return;

    await publishAutoPostToUserTeams({
      authorUserId: input.userId,
      type: "workout_complete",
      body: `Ukończono: ${input.title || "Trening"}`,
      snapshot: {
        workoutId: input.workoutId,
        title: input.title,
        date: input.dateKey,
        tonnageKg: Math.round(tonnage),
        sets: setCount,
        cardioMinutes: input.cardioMinutes,
        volumeDeltaPercent: input.planCompare?.volumeDeltaPercent ?? null,
        planLabel: input.planCompare?.planLabel ?? null,
      },
      sourceKeySuffix: `workout:${input.workoutId}`,
    });

    const history = await db
      .select({ exercises: workouts.exercises, id: workouts.id })
      .from(workouts)
      .where(eq(workouts.userId, input.userId))
      .orderBy(desc(workouts.date))
      .limit(40);

    const priorJsons = history
      .filter((h) => h.id !== input.workoutId)
      .map((h) => h.exercises);

    const prHits = detectPrHits(input.exercisesJson, priorJsons);
    for (const hit of prHits.slice(0, 3)) {
      const key = `pr:${input.workoutId}:${hit.exerciseName.toLowerCase().slice(0, 40)}`;
      await publishAutoPostToUserTeams({
        authorUserId: input.userId,
        type: "personal_record",
        body: `Nowy rekord: ${hit.exerciseName}`,
        snapshot: {
          exerciseName: hit.exerciseName,
          e1rm: hit.e1rm,
          weightKg: hit.weight,
          workoutId: input.workoutId,
        },
        sourceKeySuffix: key,
      });
    }

    const allDates = await db
      .select({ date: workouts.date, exercises: workouts.exercises })
      .from(workouts)
      .where(eq(workouts.userId, input.userId));

    let totalTonnage = 0;
    let strengthSessions = 0;
    for (const row of allDates) {
      const exs = parseExercises(row.exercises);
      const t = sessionTonnageKg(exs);
      if (t > 0 || exs.length > 0) {
        strengthSessions += 1;
        totalTonnage += t;
      }
    }

    const streakWeeks = computeStreakWeeks(allDates.map((r) => r.date));
    const firstWorkoutDate =
      allDates.map((r) => r.date).sort()[0] ?? input.dateKey;

    const achievements = computeAchievements({
      totalTonnageKg: totalTonnage,
      totalStrengthSessions: strengthSessions,
      streakWeeks,
      weightDeltaKg: null,
      waistDeltaCm: null,
      firstWorkoutDate,
      firstReportDate: null,
    });

    for (const a of achievements) {
      if (!a.unlockedAt) continue;
      const claimed = await tryClaimMilestone(input.userId, "achievement", a.id, {
        title: a.title,
      });
      if (!claimed) continue;
      await publishAutoPostToUserTeams({
        authorUserId: input.userId,
        type: "achievement",
        body: `Osiągnięcie: ${a.title}`,
        snapshot: {
          achievementId: a.id,
          title: a.title,
          description: a.description,
          icon: a.icon,
        },
        sourceKeySuffix: `achievement:${a.id}`,
      });
      try {
        const { emitNotification } = await import(
          "@/lib/community/notifications"
        );
        await emitNotification({
          userId: input.userId,
          kind: "achievement",
          title: "Nowe osiągnięcie",
          body: a.title,
          href: "/progress",
          entityType: "achievement",
          entityId: a.id,
          groupKey: `achievement:${a.id}`,
        });
      } catch {
        /* ignore */
      }
    }

    for (const weeks of [2, 3, 8]) {
      if (streakWeeks < weeks) continue;
      const claimed = await tryClaimMilestone(
        input.userId,
        "streak",
        `weeks-${weeks}`,
        { streakWeeks },
      );
      if (!claimed) continue;
      await publishAutoPostToUserTeams({
        authorUserId: input.userId,
        type: "streak",
        body: `Streak: ${weeks} tygodni z rzędu`,
        snapshot: { streakWeeks: weeks },
        sourceKeySuffix: `streak:weeks-${weeks}`,
      });
    }

    const level = levelFromSessions(strengthSessions);
    const claimedLevel = await tryClaimMilestone(
      input.userId,
      "level",
      `lvl-${level}`,
      { level, sessions: strengthSessions },
    );
    if (claimedLevel && level > 1) {
      await publishAutoPostToUserTeams({
        authorUserId: input.userId,
        type: "level_up",
        body: `Nowy poziom: ${level}`,
        snapshot: { level, sessions: strengthSessions },
        sourceKeySuffix: `level:${level}`,
      });
    }
  } catch (err) {
    console.error("[team-feed-auto] publish failed", err);
  }
}

/** Wywołanie z modułu Challenges — ukończony challenge. */
export async function publishChallengeCompleteFeed(input: {
  userId: string;
  challengeId: string;
  title: string;
  score?: number;
}) {
  const claimed = await tryClaimMilestone(
    input.userId,
    "challenge",
    input.challengeId,
    { title: input.title, score: input.score ?? null },
  );
  if (!claimed) return;
  await publishAutoPostToUserTeams({
    authorUserId: input.userId,
    type: "challenge_complete",
    body: `Ukończono challenge: ${input.title}`,
    snapshot: {
      challengeId: input.challengeId,
      title: input.title,
      score: input.score ?? null,
    },
    sourceKeySuffix: `challenge:${input.challengeId}`,
  });
}
