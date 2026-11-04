import "server-only";

import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { trainingSessions, userSettings, workouts } from "@/db/schema";
import {
  cardioGoalPercent,
  parseCardioWeekMode,
  resolveCardioWeekRange,
  sumCardioInRange,
  type CardioWeekMode,
  type CardioWeekRange,
} from "@/lib/cardio-week-range";
import { formatCardioWeekShortLabel } from "@/lib/cardio-utils";
import { addCalendarDays, calendarDateKey } from "@/lib/local-date";

export type CardioWeekSummary = {
  minutes: number;
  sessions: number;
  goalMinutes: number;
  percent: number;
  mode: CardioWeekMode;
  range: CardioWeekRange;
  /** Np. „2 lis–8 lis”. */
  weekLabel: string;
};

/**
 * Jedyne źródło prawdy dla minut cardio w tygodniu (Pulpit, Trening, arkusz
 * „Dodaj cardio”, raporty). Tryb tygodnia bierze z ustawień użytkownika
 * (`cardio_week_mode`), chyba że wywołujący poda `mode`.
 */
export async function getCardioWeekSummary(
  userId: string,
  opts: { todayKey?: string; mode?: CardioWeekMode } = {},
): Promise<CardioWeekSummary> {
  const db = getDb();
  const todayKey = opts.todayKey ?? calendarDateKey();

  const [settings] = await db
    .select({
      goal: userSettings.weeklyCardioGoalMinutes,
      mode: userSettings.cardioWeekMode,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const mode = opts.mode ?? parseCardioWeekMode(settings?.mode);
  const range = resolveCardioWeekRange(todayKey, mode);
  const goalMinutes = settings?.goal ?? 150;

  const workoutRows = await db
    .select({
      date: workouts.date,
      cardioMinutes: workouts.cardioMinutes,
      exercises: workouts.exercises,
    })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, range.from),
        lte(workouts.date, range.to),
      ),
    );

  // Szeroki filtr po czasie (±1 doba), dokładny podział na dni robi `sumCardioInRange`
  // wg `calendarDateKey` — nie wg strefy procesu serwera.
  const legacyRows = await db
    .select({
      startedAt: trainingSessions.startedAt,
      cardioMinutes: trainingSessions.cardioMinutes,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        gte(
          trainingSessions.startedAt,
          new Date(`${addCalendarDays(range.from, -1)}T00:00:00Z`),
        ),
        lte(
          trainingSessions.startedAt,
          new Date(`${addCalendarDays(range.to, 1)}T23:59:59Z`),
        ),
      ),
    );

  const { minutes, sessions } = sumCardioInRange(range, workoutRows, legacyRows);

  return {
    minutes,
    sessions,
    goalMinutes,
    percent: cardioGoalPercent(minutes, goalMinutes),
    mode,
    range,
    weekLabel: formatCardioWeekShortLabel(range.from),
  };
}
