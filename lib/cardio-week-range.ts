/**
 * Jedna definicja „tygodnia cardio” dla Pulpitu, Treningów, arkusza „Dodaj cardio”
 * i raportów (US12 / Z35, Z38). Czysta logika — bez DB, działa też w testach i na kliencie.
 *
 * - `calendar` (domyślnie): poniedziałek–niedziela wg `getCalendarTimezone()`.
 * - `rolling`: 7 ostatnich dni kalendarzowych włącznie z dziś (wybór użytkownika).
 */
import {
  addCalendarDays,
  calendarDateKey,
  calendarWeekMondayKey,
} from "@/lib/local-date";
import {
  countableCardioMinutes,
  parseWorkoutSessionJson,
} from "@/lib/workout-cardio-attribution";

export const CARDIO_WEEK_MODES = ["calendar", "rolling"] as const;
export type CardioWeekMode = (typeof CARDIO_WEEK_MODES)[number];
export const DEFAULT_CARDIO_WEEK_MODE: CardioWeekMode = "calendar";

export function parseCardioWeekMode(value: unknown): CardioWeekMode {
  return value === "rolling" ? "rolling" : DEFAULT_CARDIO_WEEK_MODE;
}

export type CardioWeekRange = {
  mode: CardioWeekMode;
  /** YYYY-MM-DD, włącznie. */
  from: string;
  /** YYYY-MM-DD, włącznie. */
  to: string;
};

export function resolveCardioWeekRange(
  todayKey: string,
  mode: CardioWeekMode = DEFAULT_CARDIO_WEEK_MODE,
): CardioWeekRange {
  if (mode === "rolling") {
    return { mode, from: addCalendarDays(todayKey, -6), to: todayKey };
  }
  const monday = calendarWeekMondayKey(todayKey);
  return { mode, from: monday, to: addCalendarDays(monday, 6) };
}

export type CardioWorkoutRow = {
  date: string;
  cardioMinutes: number | null;
  exercises: string;
};

/** Starsza tabela `training_sessions` — data wg tej samej strefy co reszta aplikacji. */
export type CardioLegacyRow = {
  startedAt: Date | number | null;
  cardioMinutes: number | null;
};

export function isDateKeyInRange(dateKey: string, range: CardioWeekRange): boolean {
  return dateKey >= range.from && dateKey <= range.to;
}

/**
 * Jedyna reguła sumowania minut cardio: `workouts` (countableCardioMinutes)
 * + legacy `training_sessions`, oba w zakresie dat `range`.
 */
export function sumCardioInRange(
  range: CardioWeekRange,
  workoutRows: CardioWorkoutRow[],
  legacyRows: CardioLegacyRow[] = [],
): { minutes: number; sessions: number } {
  let minutes = 0;
  let sessions = 0;
  for (const row of workoutRows) {
    if (!isDateKeyInRange(row.date, range)) continue;
    const m = countableCardioMinutes(
      parseWorkoutSessionJson(row.exercises),
      row.cardioMinutes ?? 0,
    );
    if (m > 0) {
      minutes += m;
      sessions += 1;
    }
  }
  for (const row of legacyRows) {
    if (row.startedAt == null) continue;
    const m = Math.max(0, row.cardioMinutes ?? 0);
    if (m <= 0) continue;
    const key = calendarDateKey(new Date(row.startedAt));
    if (!isDateKeyInRange(key, range)) continue;
    minutes += m;
    sessions += 1;
  }
  return { minutes: Math.round(minutes), sessions };
}

export function cardioGoalPercent(minutes: number, goalMinutes: number): number {
  return goalMinutes > 0
    ? Math.min(100, Math.round((minutes / goalMinutes) * 1000) / 10)
    : 0;
}
