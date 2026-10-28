import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, workouts } from "@/db/schema";
import { addCalendarDays, calendarDateKey, calendarWeekMondayKey } from "@/lib/local-date";
import {
  countableCardioMinutes,
  isCompletedStrengthSession,
  isStandaloneCardioLog,
} from "@/lib/workout-cardio-attribution";
import { computeWorkoutDetails } from "@/lib/workout-history";
import { countPerformedSets } from "@/lib/workout-session-calculations";

export type RecentWorkoutItem = {
  id: string;
  date: string;
  title: string;
  volumeKg: number;
  durationMinutes: number | null;
  setsDone: number;
};

export type RecentCardioItem = {
  id: string;
  date: string;
  title: string;
  minutes: number;
  avgHr: number | null;
  kind: "cardio_log" | "post_strength";
};

export type TreningiHubStats = {
  workoutsThisWeek: number;
  cardioMinutesThisWeek: number;
  cardioSessionsThisWeek: number;
  cardioGoalMinutes: number;
  tonnageThisWeekKg: number;
  streakWeeks: number;
  recentWorkouts: RecentWorkoutItem[];
  recentCardio: RecentCardioItem[];
};

type ParsedSet = {
  reps?: number | string;
  weight?: number | string;
  done?: boolean;
  skipped?: boolean;
};
type ParsedExercise = { name?: string; sets?: ParsedSet[] };
type SessionJson = {
  kind?: string;
  title?: string;
  startedAt?: number;
  endedAt?: number;
  avgHr?: number | null;
  heartRate?: number | null;
  distanceKm?: number | null;
  notes?: string | null;
  exercises?: ParsedExercise[];
};

function parseSession(json: string): SessionJson | null {
  try {
    return JSON.parse(json) as SessionJson;
  } catch {
    return null;
  }
}

function metricsFromSessionJson(
  id: string,
  date: string,
  rawJson: string,
): { volumeKg: number; durationMinutes: number | null; setsDone: number; title: string } {
  const details = computeWorkoutDetails({
    id,
    date,
    rawJson,
    workoutPlanId: null,
    planName: null,
  });
  if (!details) {
    return { volumeKg: 0, durationMinutes: null, setsDone: 0, title: "Trening" };
  }
  const durationMinutes =
    details.startedAt != null &&
    details.endedAt != null &&
    details.endedAt > details.startedAt
      ? Math.max(1, Math.round((details.endedAt - details.startedAt) / 60000))
      : null;
  return {
    volumeKg: details.volumeKg,
    durationMinutes,
    setsDone: countPerformedSets(details.exercises),
    title: details.title.trim() || "Trening",
  };
}

function isGuidedStrength(parsed: SessionJson | null): boolean {
  return isCompletedStrengthSession(parsed);
}

/**
 * Statystyki i listy pod hub Treningi (tydzień kalendarzowy + ostatnie wpisy).
 * `todayKey` pozwala wyliczyć tydzień z tego samego „dziś” co reszta ekranu.
 * Tonaż / serie / czas — te same reguły co historia (`computeWorkoutDetails`).
 */
export async function getTreningiHubStats(
  userId: string,
  todayKey: string = calendarDateKey(),
): Promise<TreningiHubStats> {
  const db = getDb();
  const monday = calendarWeekMondayKey(todayKey);
  const sunday = addCalendarDays(monday, 6);
  const streakLookbackMonday = addCalendarDays(monday, -7 * 11);

  const [goalRow] = await db
    .select({ goal: userSettings.weeklyCardioGoalMinutes })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const lookbackRows = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      cardioMinutes: workouts.cardioMinutes,
      exercises: workouts.exercises,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, streakLookbackMonday),
        lte(workouts.date, sunday),
      ),
    )
    .orderBy(desc(workouts.date), desc(workouts.id));

  let workoutsThisWeek = 0;
  let cardioMinutesThisWeek = 0;
  let cardioSessionsThisWeek = 0;
  let tonnageThisWeekKg = 0;
  const weeksWithGuided = new Set<string>();

  const recentWorkouts: RecentWorkoutItem[] = [];
  const recentCardio: RecentCardioItem[] = [];

  for (const row of lookbackRows) {
    const parsed = parseSession(row.exercises);
    const metrics = metricsFromSessionJson(row.id, row.date, row.exercises);
    const inThisWeek = row.date >= monday && row.date <= sunday;
    if (inThisWeek) {
      const weekCardio = countableCardioMinutes(parsed, row.cardioMinutes ?? 0);
      cardioMinutesThisWeek += weekCardio;
      if (weekCardio > 0) cardioSessionsThisWeek += 1;
      if (isGuidedStrength(parsed)) {
        workoutsThisWeek += 1;
        tonnageThisWeekKg += metrics.volumeKg;
      }
    }
    if (isGuidedStrength(parsed)) {
      weeksWithGuided.add(calendarWeekMondayKey(row.date));
      if (recentWorkouts.length < 8) {
        recentWorkouts.push({
          id: row.id,
          date: row.date,
          title: metrics.title,
          volumeKg: metrics.volumeKg,
          durationMinutes: metrics.durationMinutes,
          setsDone: metrics.setsDone,
        });
      }
    }
    const standaloneCardio = isStandaloneCardioLog(parsed, row.cardioMinutes ?? 0);
    const postStrengthCardio =
      isCompletedStrengthSession(parsed) && (row.cardioMinutes ?? 0) > 0;
    if ((standaloneCardio || postStrengthCardio) && recentCardio.length < 8) {
      const title = standaloneCardio
        ? typeof parsed?.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : "Cardio"
        : `${metrics.title} · cardio`;
      const avgHrRaw = parsed?.avgHr ?? parsed?.heartRate ?? null;
      const avgHr =
        typeof avgHrRaw === "number" && Number.isFinite(avgHrRaw) && avgHrRaw > 0
          ? Math.round(avgHrRaw)
          : null;
      recentCardio.push({
        id: row.id,
        date: row.date,
        title,
        minutes: Math.max(0, row.cardioMinutes ?? 0),
        avgHr,
        kind: parsed?.kind === "cardio_log" ? "cardio_log" : "post_strength",
      });
    }
  }

  let streakWeeks = 0;
  for (let w = 0; w < 12; w++) {
    const weekMonday = addCalendarDays(monday, -7 * w);
    if (!weeksWithGuided.has(weekMonday)) break;
    streakWeeks += 1;
  }

  return {
    workoutsThisWeek,
    cardioMinutesThisWeek,
    cardioSessionsThisWeek,
    cardioGoalMinutes: goalRow?.goal ?? 150,
    tonnageThisWeekKg,
    streakWeeks,
    recentWorkouts,
    recentCardio,
  };
}
