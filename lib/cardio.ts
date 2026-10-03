import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { trainingSessions, userSettings, workouts } from "@/db/schema";
import { calendarDateKey } from "@/lib/local-date";
import {
  countableCardioMinutes,
  parseWorkoutSessionJson,
} from "@/lib/workout-cardio-attribution";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Rolling 7-day cardio: sums `workouts` (by local `date`) plus legacy
 * `training_sessions` rows in the same window so older data still counts.
 */
export async function getWeeklyCardioProgress(userId: string) {
  const db = getDb();
  const now = new Date();
  const weekAgo = new Date(Date.now() - WEEK_MS);

  const [goalRow] = await db
    .select({ goal: userSettings.weeklyCardioGoalMinutes })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const weeklyGoal = goalRow?.goal ?? 150;

  const todayKey = calendarDateKey(now);
  const minWorkoutDateKey = calendarDateKey(weekAgo);

  const workoutRows = await db
    .select({
      cardioMinutes: workouts.cardioMinutes,
      exercises: workouts.exercises,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, minWorkoutDateKey),
        lte(workouts.date, todayKey),
      ),
    );

  let fromWorkoutsTotal = 0;
  for (const row of workoutRows) {
    const parsed = parseWorkoutSessionJson(row.exercises);
    fromWorkoutsTotal += countableCardioMinutes(parsed, row.cardioMinutes ?? 0);
  }

  const [fromLegacySessions] = await db
    .select({
      total: sql<number>`coalesce(sum(${trainingSessions.cardioMinutes}), 0)`,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        gte(trainingSessions.startedAt, weekAgo),
      ),
    );

  const minutesCompleted =
    fromWorkoutsTotal + Number(fromLegacySessions?.total ?? 0);

  const pct =
    weeklyGoal > 0
      ? Math.min(100, Math.round((minutesCompleted / weeklyGoal) * 1000) / 10)
      : 0;

  return {
    weeklyGoal,
    minutesCompleted,
    percent: pct,
  };
}

export type CardioLogPayload = {
  kind: "cardio_log";
  title: string;
  notes?: string | null;
  distanceKm?: number | null;
  avgHr?: number | null;
  calories?: number | null;
  steps?: number | null;
  paceMinPerKm?: number | null;
  devicePhotoDataUrl?: string | null;
};

export function parseCardioLog(raw: unknown): CardioLogPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== "cardio_log") return null;
  return {
    kind: "cardio_log",
    title: typeof o.title === "string" && o.title.trim() ? o.title.trim() : "Cardio",
    notes: typeof o.notes === "string" ? o.notes : null,
    distanceKm:
      typeof o.distanceKm === "number" && Number.isFinite(o.distanceKm)
        ? o.distanceKm
        : null,
    avgHr:
      typeof o.avgHr === "number" && Number.isFinite(o.avgHr) ? o.avgHr : null,
    calories:
      typeof o.calories === "number" && Number.isFinite(o.calories)
        ? o.calories
        : null,
    steps:
      typeof o.steps === "number" && Number.isFinite(o.steps) ? o.steps : null,
    paceMinPerKm:
      typeof o.paceMinPerKm === "number" && Number.isFinite(o.paceMinPerKm)
        ? o.paceMinPerKm
        : null,
    devicePhotoDataUrl:
      typeof o.devicePhotoDataUrl === "string" ? o.devicePhotoDataUrl : null,
  };
}

export function computePaceMinPerKm(
  distanceKm: number | null | undefined,
  minutes: number,
): number | null {
  if (
    distanceKm == null ||
    !Number.isFinite(distanceKm) ||
    distanceKm <= 0 ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    return null;
  }
  return minutes / distanceKm;
}

export function formatPace(paceMinPerKm: number | null | undefined): string {
  if (paceMinPerKm == null || !Number.isFinite(paceMinPerKm) || paceMinPerKm <= 0) {
    return "—";
  }
  const whole = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - whole) * 60);
  const s = secs === 60 ? 0 : secs;
  const m = secs === 60 ? whole + 1 : whole;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatDurationMmSs(minutes: number): string {
  const totalSec = Math.max(0, Math.round(minutes * 60));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatCardioDateLabel(dateKey: string, createdHint?: Date): string {
  try {
    const d = createdHint ?? new Date(`${dateKey}T12:00:00`);
    return new Intl.DateTimeFormat("pl-PL", {
      weekday: "short",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    })
      .format(d)
      .replace(/\./g, "")
      .toUpperCase();
  } catch {
    return dateKey;
  }
}
