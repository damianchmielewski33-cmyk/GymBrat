import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { withDbRetry } from "@/db/with-retry";
import { getCardioWeekSummary } from "@/lib/cardio-week";
import { calendarDateKey, weekDateKeysMondayFirst } from "@/lib/local-date";
import { parseFitnessGoalsJson } from "@/lib/fitness-goals";
import { countDistinctWorkoutDaysInRange } from "@/lib/weekly-sessions";
import { computeExtraCardioAdvice } from "@/lib/extra-cardio-from-macros";
import { getMacroSeriesAndToday } from "@/lib/home-start-macros";
import { getLatestDimensions } from "@/lib/home-start-photos";
import { getProgramStartAndReportCount, getReportInsights } from "@/lib/home-start-reports";
import { getNextWorkoutPlan, getRecentCardioSamples, getWorkoutStreakWeeks } from "@/lib/home-start-training";
import type { HomeStartDashboard } from "@/lib/home-start-types";
import { getWeightFromStart, getWeightSeries } from "@/lib/home-start-weight";

export type { HomeStartDashboard, HomeStartMacroPoint, HomeStartSpark, HomeStartTodayMacros, HomeStartWaistPoint, HomeStartWeekMacros, HomeStartWeightPoint } from "@/lib/home-start-types";
export { mergeWeightPointsByDay } from "@/lib/home-start-weight";
export { getTransformationPhotos } from "@/lib/home-start-photos";
export { consecutiveWorkoutStreakFromKeys, consecutiveWorkoutWeeksFromKeys, getNextWorkoutPlan } from "@/lib/home-start-training";

export async function getHomeStartDashboard(
  userId: string,
): Promise<HomeStartDashboard> {
  return withDbRetry(() => loadHomeStartDashboard(userId), {
    attempts: 3,
    baseDelayMs: 280,
    label: "home-start",
  });
}

async function loadHomeStartDashboard(
  userId: string,
): Promise<HomeStartDashboard> {
  const db = getDb();
  const todayKey = calendarDateKey();
  const weekKeys = weekDateKeysMondayFirst(todayKey);
  const weekStart = weekKeys[0]!;
  const weekEnd = weekKeys[weekKeys.length - 1]!;

  const [
    userRow,
    settingsRow,
    nextWorkout,
    workoutsThisWeek,
    cardioWeek,
    recentCardioSamples,
    workoutStreakWeeks,
    weightFromStart,
    weightSeries,
    macroBundle,
    dimensions,
    reportInsights,
    programMeta,
  ] = await Promise.all([
    db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        name: users.name,
        weightKg: users.weightKg,
        age: users.age,
        sex: users.sex,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        reportCadenceDays: userSettings.reportCadenceDays,
        fitnessGoalsJson: userSettings.fitnessGoalsJson,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getNextWorkoutPlan(userId),
    countDistinctWorkoutDaysInRange(userId, weekStart, weekEnd),
    getCardioWeekSummary(userId, { todayKey }),
    getRecentCardioSamples(userId, todayKey),
    getWorkoutStreakWeeks(userId, todayKey),
    getWeightFromStart(userId),
    getWeightSeries(userId),
    getMacroSeriesAndToday(userId),
    getLatestDimensions(userId),
    getReportInsights(userId),
    getProgramStartAndReportCount(userId),
  ]);

  const firstName =
    userRow?.firstName?.trim() ||
    userRow?.name?.trim()?.split(/\s+/)[0] ||
    null;
  const lastName =
    userRow?.lastName?.trim() ||
    userRow?.name?.trim()?.split(/\s+/).slice(1).join(" ") ||
    null;

  const currentWeightKg =
    weightFromStart.currentKg ??
    dimensions.weightKg ??
    userRow?.weightKg ??
    null;

  // Preferuj dni od pierwszego raportu; fallback: data konta.
  let daysInProgram = programMeta.daysInProgram;
  if (daysInProgram == null) {
    const createdAt = userRow?.createdAt ? new Date(userRow.createdAt) : null;
    daysInProgram =
      createdAt && !Number.isNaN(createdAt.getTime())
        ? Math.max(
            1,
            Math.floor((Date.now() - createdAt.getTime()) / 86_400_000) + 1,
          )
        : null;
  }

  const weeklySessionsTarget =
    parseFitnessGoalsJson(settingsRow?.fitnessGoalsJson ?? null)
      .weeklySessionsTarget ?? 4;

  const ageYears =
    userRow?.age != null && Number.isFinite(userRow.age) && userRow.age > 0
      ? userRow.age
      : null;

  const extraCardio = computeExtraCardioAdvice({
    today: macroBundle.today,
    elapsedDays: macroBundle.elapsedWeekDays,
    todayKey,
    weekKeys,
    weightKg: currentWeightKg,
    ageYears,
    sex:
      userRow?.sex === "male" || userRow?.sex === "female"
        ? userRow.sex
        : null,
    recentCardio: recentCardioSamples,
    weeklyCardioGoalMinutes: cardioWeek.goalMinutes,
  });

  return {
    firstName,
    lastName,
    nextWorkout,
    workoutsThisWeek,
    weeklySessionsTarget,
    cardioThisWeekMinutes: cardioWeek.minutes,
    cardioWeeklyGoal: cardioWeek.goalMinutes,
    cardioSheetWeek: {
      minutesCompleted: cardioWeek.minutes,
      goalMinutes: cardioWeek.goalMinutes,
      weekLabel: cardioWeek.weekLabel,
    },
    extraCardio,
    workoutStreakWeeks,
    daysInProgram,
    reportCount: programMeta.reportCount,
    daysSinceLastReport: reportInsights.daysSinceLastReport,
    reportCadenceDays: Math.min(
      90,
      Math.max(3, settingsRow?.reportCadenceDays ?? 14),
    ),
    currentWeightKg,
    weightFromStartKg: weightFromStart.deltaKg,
    weightDeltaFromPreviousKg: weightFromStart.deltaFromPreviousKg,
    weightSeries,
    waistSeries: reportInsights.waistSeries,
    macroSeries: macroBundle.series,
    todayMacros: macroBundle.today,
    weekMacros: macroBundle.week,
    formToday: reportInsights.formToday,
    coachNote: reportInsights.coachNote,
    compliance: reportInsights.compliance,
    transformation: {
      firstPhotoUrl: null,
      latestPhotoUrl: null,
      latestPhotoDate: null,
    },
    dimensions: {
      weightKg: dimensions.weightKg ?? currentWeightKg,
      waistCm: dimensions.waistCm,
      armCm: dimensions.armCm,
      abdomenCm: dimensions.abdomenCm,
      chestCm: dimensions.chestCm,
      thighCm: dimensions.thighCm,
      waistSpark: reportInsights.waistSpark,
      thighSpark: reportInsights.thighSpark,
      chestSpark: reportInsights.chestSpark,
      armSpark: reportInsights.armSpark,
    },
  };
}
