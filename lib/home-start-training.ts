import { and, desc, eq, gt, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { trainingSessions, workouts } from "@/db/schema";
import { addCalendarDays, calendarDateKey, weekDateKeysMondayFirst } from "@/lib/local-date";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { pickNextWorkoutPlan } from "@/lib/workout-plan-queue";
import { loadWorkoutPlansWithLastWorkout } from "@/lib/workout-plans-with-last-workout";
import { countableCardioMinutes, parseWorkoutSessionJson } from "@/lib/workout-cardio-attribution";
import { extractCardioExtrasFromSessionJson } from "@/lib/cardio-utils";
import { type RecentCardioSample } from "@/lib/extra-cardio-from-macros";
import type { HomeStartDashboard } from "@/lib/home-start-types";

/** Ostatnie sesje cardio z metrykami (tempo / kcal) — do szacunku spalania. */
export async function getRecentCardioSamples(
  userId: string,
  todayKey: string,
  /** Więcej historii pod personal burn (≥10 treningów / ≥200 min). */
  lookbackDays = 120,
  limit = 60,
): Promise<RecentCardioSample[]> {
  const db = getDb();
  const fromKey = addCalendarDays(todayKey, -lookbackDays);
  const rows = await db
    .select({
      date: workouts.date,
      cardioMinutes: workouts.cardioMinutes,
      exercises: workouts.exercises,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, fromKey),
        lte(workouts.date, todayKey),
        // Tylko wiersze z cardio — treningi siłowe bez cardio nie zjadają limitu.
        gt(workouts.cardioMinutes, 0),
      ),
    )
    .orderBy(desc(workouts.date))
    .limit(limit * 2);

  const out: RecentCardioSample[] = [];
  for (const row of rows) {
    const parsed = parseWorkoutSessionJson(row.exercises);
    const minutes = countableCardioMinutes(parsed, row.cardioMinutes ?? 0);
    if (minutes <= 0) continue;
    let raw: unknown = parsed;
    if (!raw) {
      try {
        raw = JSON.parse(row.exercises) as unknown;
      } catch {
        raw = null;
      }
    }
    const extras = extractCardioExtrasFromSessionJson(raw, minutes);
    let maxHeartRate: number | null = null;
    if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      const nested =
        o.cardio && typeof o.cardio === "object"
          ? (o.cardio as Record<string, unknown>)
          : o.cardioDetails && typeof o.cardioDetails === "object"
            ? (o.cardioDetails as Record<string, unknown>)
            : null;
      const maxRaw = o.maxHr ?? o.maxHeartRate ?? nested?.maxHr ?? nested?.maxHeartRate;
      if (typeof maxRaw === "number" && Number.isFinite(maxRaw) && maxRaw > 0) {
        maxHeartRate = Math.round(maxRaw);
      }
    }
    out.push({
      minutes,
      calories: extras.calories,
      paceMinPerKm: extras.paceMinPerKm,
      avgHeartRate: extras.avgHr,
      maxHeartRate,
      cardioType: extras.cardioType,
      dateKey: row.date,
    });
    if (out.length >= limit) break;
  }

  // Legacy `training_sessions` — te minuty liczą się do tygodniowego celu,
  // więc muszą też liczyć się do offsetu cardio (bez kcal / tempa).
  const legacyRows = await db
    .select({
      startedAt: trainingSessions.startedAt,
      cardioMinutes: trainingSessions.cardioMinutes,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        // ±1 doba zapasu; dzień ustala calendarDateKey, nie strefa procesu serwera.
        gte(
          trainingSessions.startedAt,
          new Date(`${addCalendarDays(fromKey, -1)}T00:00:00Z`),
        ),
        lte(
          trainingSessions.startedAt,
          new Date(`${addCalendarDays(todayKey, 1)}T23:59:59Z`),
        ),
        gt(trainingSessions.cardioMinutes, 0),
      ),
    );
  for (const r of legacyRows) {
    const minutes = Math.max(0, Math.round(Number(r.cardioMinutes) || 0));
    if (minutes <= 0 || !r.startedAt) continue;
    const legacyKey = calendarDateKey(new Date(r.startedAt));
    if (legacyKey < fromKey || legacyKey > todayKey) continue;
    out.push({
      minutes,
      calories: null,
      paceMinPerKm: null,
      cardioType: null,
      dateKey: legacyKey,
    });
  }
  return out;
}

type HomeNextWorkout = NonNullable<HomeStartDashboard["nextWorkout"]>;

/** Mapuje plan z kolejki na kafel „Następny trening” na Home. */
function toHomeNextWorkout(row: WorkoutPlanWithLastWorkoutDTO): HomeNextWorkout {
  return {
    planId: row.id,
    planName: row.plan.planName?.trim() || "Plan treningowy",
    exerciseCount: row.plan.exercises.length,
    lastWorkoutDate: row.lastWorkoutDate,
    exerciseNames: row.plan.exercises
      .map((ex) => String(ex.name ?? "").trim())
      .filter(Boolean)
      .slice(0, 8),
    firstTime: !row.lastWorkoutDate,
  };
}

/** Ten sam „następny” co na ekranie Trening (wspólna kolejka i loader w żądaniu). */
export async function getNextWorkoutPlan(userId: string): Promise<HomeNextWorkout | null> {
  const next = pickNextWorkoutPlan(await loadWorkoutPlansWithLastWorkout(userId));
  return next ? toHomeNextWorkout(next) : null;
}

/** Liczba kolejnych tygodni (pon–niedz.) z ≥1 dniem treningowym. */
export function consecutiveWorkoutWeeksFromKeys(
  todayKey: string,
  workoutKeys: Set<string>,
  lookbackWeeks = 52,
): number {
  let streak = 0;
  let weekOffset = 0;
  let skippedEmptyCurrent = false;

  while (weekOffset < lookbackWeeks) {
    const anchor = addCalendarDays(todayKey, -weekOffset * 7);
    const weekKeys = weekDateKeysMondayFirst(anchor);
    const hasWorkout = weekKeys.some((k) => workoutKeys.has(k));
    if (!hasWorkout) {
      if (weekOffset === 0 && !skippedEmptyCurrent) {
        skippedEmptyCurrent = true;
        weekOffset += 1;
        continue;
      }
      break;
    }
    streak += 1;
    weekOffset += 1;
  }
  return streak;
}

export async function getWorkoutStreakWeeks(
  userId: string,
  todayKey: string,
): Promise<number> {
  const db = getDb();
  const fromKey = addCalendarDays(todayKey, -(52 * 7));
  const rows = await db
    .select({ date: workouts.date })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, fromKey),
        lte(workouts.date, todayKey),
      ),
    );
  const keys = new Set(rows.map((r) => r.date).filter(Boolean));
  return consecutiveWorkoutWeeksFromKeys(todayKey, keys);
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
