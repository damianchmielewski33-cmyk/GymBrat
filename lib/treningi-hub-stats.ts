import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, workouts } from "@/db/schema";
import { addCalendarDays, calendarDateKey, calendarWeekdaySun0 } from "@/lib/local-date";

export type RecentWorkoutItem = {
  id: string;
  date: string;
  title: string;
  volumeKg: number;
  durationMinutes: number | null;
};

export type RecentCardioItem = {
  id: string;
  date: string;
  title: string;
  minutes: number;
  avgHr: number | null;
};

export type TreningiHubStats = {
  workoutsThisWeek: number;
  cardioMinutesThisWeek: number;
  cardioGoalMinutes: number;
  tonnageThisWeekKg: number;
  streakWeeks: number;
  recentWorkouts: RecentWorkoutItem[];
  recentCardio: RecentCardioItem[];
};

type ParsedSet = { reps?: number | string; weight?: number | string; done?: boolean };
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

function mondayOfWeek(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateKey, offset);
}

function parseSession(json: string): SessionJson | null {
  try {
    return JSON.parse(json) as SessionJson;
  } catch {
    return null;
  }
}

function volumeFromExercises(exercises: ParsedExercise[] | undefined): number {
  let volume = 0;
  for (const ex of exercises ?? []) {
    for (const s of ex.sets ?? []) {
      if (!s.done) continue;
      const reps = Math.max(0, Math.round(Number(s.reps ?? 0)));
      const weight = Math.max(0, Number(s.weight ?? 0));
      volume += reps * weight;
    }
  }
  return Math.round(volume);
}

function durationMinutes(parsed: SessionJson | null): number | null {
  if (!parsed) return null;
  if (
    typeof parsed.startedAt === "number" &&
    typeof parsed.endedAt === "number" &&
    parsed.endedAt > parsed.startedAt
  ) {
    return Math.max(1, Math.round((parsed.endedAt - parsed.startedAt) / 60000));
  }
  return null;
}

function isCardioLog(parsed: SessionJson | null, cardioMinutes: number): boolean {
  if (parsed?.kind === "cardio_log") return true;
  return cardioMinutes > 0 && (!parsed?.exercises || parsed.exercises.length === 0);
}

function isGuidedStrength(parsed: SessionJson | null): boolean {
  if (!parsed) return false;
  if (parsed.kind === "cardio_log") return false;
  return Array.isArray(parsed.exercises) && parsed.exercises.length > 0;
}

/** Statystyki i listy pod hub Treningi (tydzień kalendarzowy + ostatnie wpisy). */
export async function getTreningiHubStats(userId: string): Promise<TreningiHubStats> {
  const db = getDb();
  const today = calendarDateKey();
  const monday = mondayOfWeek(today);
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
  let tonnageThisWeekKg = 0;
  const weeksWithGuided = new Set<string>();

  const recentWorkouts: RecentWorkoutItem[] = [];
  const recentCardio: RecentCardioItem[] = [];

  for (const row of lookbackRows) {
    const parsed = parseSession(row.exercises);
    const inThisWeek = row.date >= monday && row.date <= sunday;
    if (inThisWeek) {
      cardioMinutesThisWeek += Math.max(0, row.cardioMinutes ?? 0);
      if (isGuidedStrength(parsed)) {
        workoutsThisWeek += 1;
        tonnageThisWeekKg += volumeFromExercises(parsed?.exercises);
      }
    }
    if (isGuidedStrength(parsed)) {
      weeksWithGuided.add(mondayOfWeek(row.date));
      if (recentWorkouts.length < 8) {
        recentWorkouts.push({
          id: row.id,
          date: row.date,
          title:
            typeof parsed?.title === "string" && parsed.title.trim()
              ? parsed.title.trim()
              : "Trening",
          volumeKg: volumeFromExercises(parsed?.exercises),
          durationMinutes: durationMinutes(parsed),
        });
      }
    }
    if (isCardioLog(parsed, row.cardioMinutes) && recentCardio.length < 8) {
      const title =
        typeof parsed?.title === "string" && parsed.title.trim()
          ? parsed.title.trim()
          : "Cardio";
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
    cardioGoalMinutes: goalRow?.goal ?? 150,
    tonnageThisWeekKg,
    streakWeeks,
    recentWorkouts,
    recentCardio,
  };
}
