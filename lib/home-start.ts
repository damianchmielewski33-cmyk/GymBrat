import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bodyReportPhotos,
  bodyReports,
  trainingSessions,
  users,
  weightLogs,
  workoutPlans,
  workouts,
} from "@/db/schema";
import { maybeDecryptSensitiveField } from "@/lib/app-field-crypto";
import {
  getNextBodyReportCountdown,
  type NextBodyReportCountdown,
} from "@/lib/body-report-schedule";
import { getLatestBodyReportMetrics } from "@/lib/body-reports";
import { getWeeklyCardioProgress } from "@/lib/cardio";
import { getHomeStats } from "@/lib/home-stats";
import {
  addCalendarDays,
  calendarDateKey,
  weekDateKeysMondayFirst,
} from "@/lib/local-date";
import { getStreaks } from "@/lib/streaks";
import { countDistinctWorkoutDaysInRange } from "@/lib/weekly-sessions";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";

export type HomeStartWeightPoint = { date: string; kg: number };

export type HomeStartDashboard = {
  firstName: string | null;
  nextWorkout: {
    planId: string;
    planName: string;
    exerciseCount: number;
    lastWorkoutDate: string | null;
  } | null;
  workoutsThisWeek: number;
  cardioThisWeekMinutes: number;
  cardioWeeklyGoal: number;
  workoutStreakDays: number;
  currentWeightKg: number | null;
  tempoKgPerMin: number | null;
  weightFromStartKg: number | null;
  weightSeries: HomeStartWeightPoint[];
  transformation: {
    firstPhotoUrl: string | null;
    latestPhotoUrl: string | null;
  };
  dimensions: {
    weightKg: number | null;
    waistCm: number | null;
    armCm: number | null;
    abdomenCm: number | null;
  };
  nextReport: NextBodyReportCountdown;
};

async function sumCardioMinutesInCalendarWeek(
  userId: string,
  weekKeys: string[],
): Promise<number> {
  const db = getDb();
  const start = weekKeys[0]!;
  const end = weekKeys[weekKeys.length - 1]!;

  const [fromWorkouts] = await db
    .select({
      total: sql<number>`coalesce(sum(${workouts.cardioMinutes}), 0)`,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, start),
        lte(workouts.date, end),
      ),
    );

  const weekStart = new Date(`${start}T00:00:00`);
  const weekEnd = new Date(`${end}T23:59:59`);

  const [fromLegacy] = await db
    .select({
      total: sql<number>`coalesce(sum(${trainingSessions.cardioMinutes}), 0)`,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        gte(trainingSessions.startedAt, weekStart),
        lte(trainingSessions.startedAt, weekEnd),
      ),
    );

  return Number(fromWorkouts?.total ?? 0) + Number(fromLegacy?.total ?? 0);
}

async function getNextWorkoutPlan(userId: string) {
  const db = getDb();

  const lastByPlan = await db
    .select({
      planId: workouts.workoutPlanId,
      lastDate: sql<string>`max(${workouts.date})`.as("last_date"),
    })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), sql`${workouts.workoutPlanId} is not null`))
    .groupBy(workouts.workoutPlanId);

  const lastMap = new Map<string, string>();
  for (const row of lastByPlan) {
    if (row.planId) lastMap.set(row.planId, row.lastDate);
  }

  const rows = await db
    .select({
      id: workoutPlans.id,
      planJson: workoutPlans.planJson,
      updatedAt: workoutPlans.updatedAt,
    })
    .from(workoutPlans)
    .where(eq(workoutPlans.userId, userId))
    .orderBy(desc(workoutPlans.updatedAt));

  type Candidate = {
    planId: string;
    planName: string;
    exerciseCount: number;
    lastWorkoutDate: string | null;
    updatedAt: string;
  };

  const candidates: Candidate[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.planJson) as unknown;
      const plan = normalizeWorkoutPlan(parsed);
      if (!plan) continue;
      candidates.push({
        planId: row.id,
        planName: plan.planName?.trim() || "Plan treningowy",
        exerciseCount: plan.exercises.length,
        lastWorkoutDate: lastMap.get(row.id) ?? null,
        updatedAt: row.updatedAt.toISOString(),
      });
    } catch {
      // pomijamy uszkodzone plany
    }
  }

  if (candidates.length === 0) return null;

  // Następny = najdawniej trenowany / nigdy nie trenowany.
  candidates.sort((a, b) => {
    if (a.lastWorkoutDate && b.lastWorkoutDate) {
      return a.lastWorkoutDate.localeCompare(b.lastWorkoutDate);
    }
    if (!a.lastWorkoutDate && b.lastWorkoutDate) return -1;
    if (a.lastWorkoutDate && !b.lastWorkoutDate) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  const next = candidates[0]!;
  return {
    planId: next.planId,
    planName: next.planName,
    exerciseCount: next.exerciseCount,
    lastWorkoutDate: next.lastWorkoutDate,
  };
}

async function getWeightSeries(userId: string): Promise<HomeStartWeightPoint[]> {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - 370);

  const rows = await db
    .select({
      recordedAt: weightLogs.recordedAt,
      weightKg: weightLogs.weightKg,
    })
    .from(weightLogs)
    .where(and(eq(weightLogs.userId, userId), gte(weightLogs.recordedAt, since)))
    .orderBy(asc(weightLogs.recordedAt));

  const byDay = new Map<string, number>();
  for (const r of rows) {
    const d =
      r.recordedAt instanceof Date ? r.recordedAt : new Date(Number(r.recordedAt));
    if (Number.isNaN(d.getTime())) continue;
    byDay.set(calendarDateKey(d), Math.round(Number(r.weightKg) * 10) / 10);
  }

  return [...byDay.entries()].map(([date, kg]) => ({ date, kg }));
}

async function getWeightFromStart(userId: string): Promise<{
  currentKg: number | null;
  deltaKg: number | null;
}> {
  const db = getDb();
  const [first] = await db
    .select({ weightKg: weightLogs.weightKg })
    .from(weightLogs)
    .where(eq(weightLogs.userId, userId))
    .orderBy(asc(weightLogs.recordedAt))
    .limit(1);
  const [last] = await db
    .select({ weightKg: weightLogs.weightKg })
    .from(weightLogs)
    .where(eq(weightLogs.userId, userId))
    .orderBy(desc(weightLogs.recordedAt))
    .limit(1);

  const firstKg = first?.weightKg != null ? Number(first.weightKg) : null;
  const lastKg = last?.weightKg != null ? Number(last.weightKg) : null;

  if (firstKg == null || lastKg == null) {
    return { currentKg: lastKg, deltaKg: null };
  }
  return {
    currentKg: Math.round(lastKg * 10) / 10,
    deltaKg: Math.round((lastKg - firstKg) * 10) / 10,
  };
}

async function getTransformationPhotos(userId: string): Promise<{
  firstPhotoUrl: string | null;
  latestPhotoUrl: string | null;
}> {
  const db = getDb();
  const reports = await db
    .select({ id: bodyReports.id, createdAt: bodyReports.createdAt })
    .from(bodyReports)
    .where(eq(bodyReports.userId, userId))
    .orderBy(asc(bodyReports.createdAt), asc(bodyReports.id));

  if (reports.length === 0) {
    return { firstPhotoUrl: null, latestPhotoUrl: null };
  }

  const reportIds = reports.map((r) => r.id);
  const photos = await db
    .select({
      reportId: bodyReportPhotos.reportId,
      dataUrl: bodyReportPhotos.dataUrl,
      createdAt: bodyReportPhotos.createdAt,
    })
    .from(bodyReportPhotos)
    .where(
      reportIds.length === 1
        ? eq(bodyReportPhotos.reportId, reportIds[0]!)
        : inArray(bodyReportPhotos.reportId, reportIds),
    )
    .orderBy(asc(bodyReportPhotos.createdAt), asc(bodyReportPhotos.id));

  if (photos.length === 0) {
    return { firstPhotoUrl: null, latestPhotoUrl: null };
  }

  const photosByReport = new Map<string, string[]>();
  for (const p of photos) {
    const url = maybeDecryptSensitiveField(p.dataUrl);
    if (!url) continue;
    const arr = photosByReport.get(p.reportId) ?? [];
    arr.push(url);
    photosByReport.set(p.reportId, arr);
  }

  let firstPhotoUrl: string | null = null;
  let latestPhotoUrl: string | null = null;
  for (const r of reports) {
    const urls = photosByReport.get(r.id);
    if (!urls?.length) continue;
    if (!firstPhotoUrl) firstPhotoUrl = urls[0]!;
    latestPhotoUrl = urls[0]!;
  }

  return { firstPhotoUrl, latestPhotoUrl };
}

async function getLatestDimensions(userId: string) {
  const db = getDb();
  const [r] = await db
    .select({
      weightKg: bodyReports.weightKg,
      waistCm: bodyReports.waistCm,
      armCm: bodyReports.armCm,
      abdomenCm: bodyReports.abdomenCm,
    })
    .from(bodyReports)
    .where(eq(bodyReports.userId, userId))
    .orderBy(desc(bodyReports.createdAt), desc(bodyReports.id))
    .limit(1);

  return {
    weightKg: r?.weightKg ?? null,
    waistCm: r?.waistCm ?? null,
    armCm: r?.armCm ?? null,
    abdomenCm: r?.abdomenCm ?? null,
  };
}

export async function getHomeStartDashboard(
  userId: string,
): Promise<HomeStartDashboard> {
  const db = getDb();
  const todayKey = calendarDateKey();
  const weekKeys = weekDateKeysMondayFirst(todayKey);
  const weekStart = weekKeys[0]!;
  const weekEnd = weekKeys[weekKeys.length - 1]!;

  const [
    userRow,
    nextWorkout,
    workoutsThisWeek,
    cardioThisWeekMinutes,
    cardioRolling,
    streaks,
    stats,
    weightFromStart,
    weightSeries,
    transformation,
    dimensions,
    latestReport,
  ] = await Promise.all([
    db
      .select({
        firstName: users.firstName,
        name: users.name,
        weightKg: users.weightKg,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getNextWorkoutPlan(userId),
    countDistinctWorkoutDaysInRange(userId, weekStart, weekEnd),
    sumCardioMinutesInCalendarWeek(userId, weekKeys),
    getWeeklyCardioProgress(userId),
    getStreaks(userId, todayKey, 60),
    getHomeStats(userId),
    getWeightFromStart(userId),
    getWeightSeries(userId),
    getTransformationPhotos(userId),
    getLatestDimensions(userId),
    getLatestBodyReportMetrics(userId),
  ]);

  const firstName =
    userRow?.firstName?.trim() ||
    userRow?.name?.trim()?.split(/\s+/)[0] ||
    null;

  let tempoKgPerMin: number | null = null;
  const last = stats.lastWorkout;
  if (last && last.durationMinutes && last.durationMinutes > 0 && last.volumeKg > 0) {
    tempoKgPerMin = Math.round((last.volumeKg / last.durationMinutes) * 10) / 10;
  }

  const currentWeightKg =
    weightFromStart.currentKg ??
    dimensions.weightKg ??
    userRow?.weightKg ??
    null;

  return {
    firstName,
    nextWorkout,
    workoutsThisWeek,
    cardioThisWeekMinutes,
    cardioWeeklyGoal: cardioRolling.weeklyGoal,
    workoutStreakDays: streaks.streak.workoutDays,
    currentWeightKg,
    tempoKgPerMin,
    weightFromStartKg: weightFromStart.deltaKg,
    weightSeries,
    transformation,
    dimensions: {
      weightKg: dimensions.weightKg ?? currentWeightKg,
      waistCm: dimensions.waistCm,
      armCm: dimensions.armCm,
      abdomenCm: dimensions.abdomenCm,
    },
    nextReport: getNextBodyReportCountdown(latestReport?.createdAt ?? null, {
      todayKey,
    }),
  };
}

/** Pomocnicze — używane w testach / ewentualnym rozszerzeniu streaku. */
export function consecutiveWorkoutStreakFromKeys(
  todayKey: string,
  workoutKeys: Set<string>,
  lookbackDays = 60,
): number {
  let streak = 0;
  for (let i = 0; i < lookbackDays; i++) {
    const key = addCalendarDays(todayKey, -i);
    if (!workoutKeys.has(key)) break;
    streak += 1;
  }
  return streak;
}
