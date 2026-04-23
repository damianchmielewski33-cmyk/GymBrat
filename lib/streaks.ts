import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  dailyCheckins,
  mealLogs,
  weightLogs,
  workouts,
  trainingSessions,
} from "@/db/schema";
import { addCalendarDays } from "@/lib/local-date";
import { ensureMealLogsTableOncePerProcess } from "@/db/ensure-schema";

export type StreakStripDay = {
  dateKey: string;
  checkIn: boolean;
  mealLogged: boolean;
  workout: boolean;
  weighIn: boolean;
};

export type Streaks = {
  todayKey: string;
  days: StreakStripDay[];
  streak: {
    checkInDays: number;
    mealLoggedDays: number;
    workoutDays: number;
    weighInDays: number;
  };
};

function lastNDaysKeys(todayKey: string, n: number): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) keys.push(addCalendarDays(todayKey, -i));
  return keys;
}

function streakFromEnd(
  days: StreakStripDay[],
  pick: (d: StreakStripDay) => boolean,
): number {
  let s = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (!pick(days[i])) break;
    s += 1;
  }
  return s;
}

export async function getStreaks(
  userId: string,
  todayKey: string,
  windowDays = 7,
): Promise<Streaks> {
  const keys = lastNDaysKeys(todayKey, windowDays);
  const fromKey = keys[0]!;
  const toKey = keys[keys.length - 1]!;

  const db = getDb();

  const [checkinsRows, workoutsRows, mealAgg, weighRows, legacyRows] =
    await Promise.all([
      db
        .select({ date: dailyCheckins.date })
        .from(dailyCheckins)
        .where(
          and(
            eq(dailyCheckins.userId, userId),
            gte(dailyCheckins.date, fromKey),
            lte(dailyCheckins.date, toKey),
          ),
        ),
      db
        .select({ date: workouts.date })
        .from(workouts)
        .where(
          and(
            eq(workouts.userId, userId),
            gte(workouts.date, fromKey),
            lte(workouts.date, toKey),
          ),
        ),
      (async () => {
        await ensureMealLogsTableOncePerProcess();
        const rows = await db
          .select({
            date: mealLogs.date,
            n: sql<number>`count(1)`,
          })
          .from(mealLogs)
          .where(and(eq(mealLogs.userId, userId), inArray(mealLogs.date, keys)))
          .groupBy(mealLogs.date);
        const map = new Map<string, number>();
        for (const r of rows) map.set(r.date, Number(r.n ?? 0));
        return map;
      })(),
      db
        .select({
          recordedAt: weightLogs.recordedAt,
        })
        .from(weightLogs)
        .where(
          and(
            eq(weightLogs.userId, userId),
            gte(weightLogs.recordedAt, new Date(`${fromKey}T00:00:00`)),
            lte(weightLogs.recordedAt, new Date(`${toKey}T23:59:59`)),
          ),
        ),
      // Legacy sessions count for workout streak too.
      db
        .select({ startedAt: trainingSessions.startedAt })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.userId, userId),
            gte(trainingSessions.startedAt, new Date(`${fromKey}T00:00:00`)),
            lte(trainingSessions.startedAt, new Date(`${toKey}T23:59:59`)),
          ),
        ),
    ]);

  const checkinSet = new Set(checkinsRows.map((r) => r.date));
  const workoutSet = new Set(workoutsRows.map((r) => r.date));

  // Weight logs: bucket by calendar date key (same as Start).
  const weighSet = new Set<string>();
  for (const r of weighRows) {
    const d =
      r.recordedAt instanceof Date ? r.recordedAt : new Date(Number(r.recordedAt));
    if (Number.isNaN(d.getTime())) continue;
    // Lazy import to avoid circular deps.
    const { calendarDateKey } = await import("@/lib/local-date");
    const k = calendarDateKey(d);
    if (k >= fromKey && k <= toKey) weighSet.add(k);
  }

  // Legacy: bucket by calendar date key too.
  for (const r of legacyRows) {
    const d =
      r.startedAt instanceof Date ? r.startedAt : new Date(Number(r.startedAt));
    if (Number.isNaN(d.getTime())) continue;
    const { calendarDateKey } = await import("@/lib/local-date");
    const k = calendarDateKey(d);
    if (k >= fromKey && k <= toKey) workoutSet.add(k);
  }

  const days: StreakStripDay[] = keys.map((k) => ({
    dateKey: k,
    checkIn: checkinSet.has(k),
    mealLogged: (mealAgg.get(k) ?? 0) > 0,
    workout: workoutSet.has(k),
    weighIn: weighSet.has(k),
  }));

  return {
    todayKey,
    days,
    streak: {
      checkInDays: streakFromEnd(days, (d) => d.checkIn),
      mealLoggedDays: streakFromEnd(days, (d) => d.mealLogged),
      workoutDays: streakFromEnd(days, (d) => d.workout),
      weighInDays: streakFromEnd(days, (d) => d.weighIn),
    },
  };
}

