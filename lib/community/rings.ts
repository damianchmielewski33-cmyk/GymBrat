/**
 * Pierścienie tygodnia (trening + cardio) — widok + idempotentna nagroda XP.
 * ADR 0011 §4.2 / US-3. Dane tylko dla właściciela (prawo 012).
 */

import "server-only";

import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { userSettings, workouts } from "@/db/schema";
import { parseFitnessGoalsJson } from "@/lib/fitness-goals";
import { awardProgressionXp } from "@/lib/community/progression";
import {
  addCalendarDays,
  calendarDateKey,
  weekBounds,
} from "@/lib/community/week";

const DEFAULT_SESSIONS_TARGET = 3;
const DEFAULT_CARDIO_MINUTES = 150;
const RING_CLOSE_XP = 40;

export type WeeklyRingState = {
  kind: "training" | "cardio";
  current: number;
  target: number;
  closed: boolean;
  usingDefaultTarget: boolean;
};

export type WeeklyRingsView = {
  weekStart: string;
  weekEnd: string;
  training: WeeklyRingState;
  cardio: WeeklyRingState;
};

export async function getWeeklyRingsForUser(
  userId: string,
  dateKey: string = calendarDateKey(),
): Promise<WeeklyRingsView> {
  await ensureCriticalSchema();
  const { weekStart, weekEnd } = weekBounds(dateKey);
  const db = getDb();

  const [settings] = await db
    .select({
      fitnessGoalsJson: userSettings.fitnessGoalsJson,
      weeklyCardioGoalMinutes: userSettings.weeklyCardioGoalMinutes,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const goals = parseFitnessGoalsJson(settings?.fitnessGoalsJson);
  const sessionsTarget =
    goals.weeklySessionsTarget ?? DEFAULT_SESSIONS_TARGET;
  const usingDefaultSessions = goals.weeklySessionsTarget == null;
  const cardioTarget =
    settings?.weeklyCardioGoalMinutes ?? DEFAULT_CARDIO_MINUTES;
  const usingDefaultCardio = settings?.weeklyCardioGoalMinutes == null;

  const rows = await db
    .select({
      date: workouts.date,
      cardioMinutes: workouts.cardioMinutes,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, weekStart),
        lt(workouts.date, addCalendarDays(weekEnd, 1)),
      ),
    );

  const trainingDays = new Set<string>();
  let cardioMinutes = 0;
  for (const r of rows) {
    trainingDays.add(r.date);
    cardioMinutes += Number(r.cardioMinutes) || 0;
  }

  const trainingCurrent = trainingDays.size;
  const trainingClosed = trainingCurrent >= sessionsTarget;
  const cardioClosed = cardioMinutes >= cardioTarget;

  return {
    weekStart,
    weekEnd,
    training: {
      kind: "training",
      current: trainingCurrent,
      target: sessionsTarget,
      closed: trainingClosed,
      usingDefaultTarget: usingDefaultSessions,
    },
    cardio: {
      kind: "cardio",
      current: Math.round(cardioMinutes),
      target: cardioTarget,
      closed: cardioClosed,
      usingDefaultTarget: usingDefaultCardio,
    },
  };
}

/** Idempotentne XP za zamknięcie pierścienia w danym tygodniu. */
export async function awardRingClosedIfNeeded(
  userId: string,
  rings: WeeklyRingsView,
): Promise<void> {
  for (const ring of [rings.training, rings.cardio] as const) {
    if (!ring.closed) continue;
    await awardProgressionXp({
      userId,
      amount: RING_CLOSE_XP,
      source: "ring_closed",
      sourceKey: `ring:${userId}:${rings.weekStart}:${ring.kind}`,
      skipCommunity: true,
    });
  }
}

/** Czy użytkownik ma ≥1 trening w bieżącym tygodniu (seria „at risk”). */
export async function hasWorkoutThisWeek(
  userId: string,
  dateKey: string = calendarDateKey(),
): Promise<boolean> {
  await ensureCriticalSchema();
  const { weekStart, weekEnd } = weekBounds(dateKey);
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, weekStart),
        lt(workouts.date, addCalendarDays(weekEnd, 1)),
      ),
    );
  return Number(row?.n ?? 0) > 0;
}

export async function countDistinctTrainingDaysThisWeek(
  userIds: string[],
  dateKey: string = calendarDateKey(),
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  const { weekStart, weekEnd } = weekBounds(dateKey);
  const db = getDb();
  const rows = await db
    .select({ userId: workouts.userId, date: workouts.date })
    .from(workouts)
    .where(
      and(
        inArray(workouts.userId, userIds),
        gte(workouts.date, weekStart),
        lt(workouts.date, addCalendarDays(weekEnd, 1)),
      ),
    );
  const byUser = new Map<string, Set<string>>();
  for (const r of rows) {
    let set = byUser.get(r.userId);
    if (!set) {
      set = new Set();
      byUser.set(r.userId, set);
    }
    set.add(r.date);
  }
  for (const id of userIds) {
    out.set(id, byUser.get(id)?.size ?? 0);
  }
  return out;
}
