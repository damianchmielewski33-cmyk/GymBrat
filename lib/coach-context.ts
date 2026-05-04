import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import type { ChatCoachPromptInput } from "@/ai/prompts/chatCoach";
import type { LatestBodyReportMetrics } from "@/lib/body-reports";
import { getLatestBodyReportMetrics } from "@/lib/body-reports";
import type { HomeStats } from "@/lib/home-stats";
import { getHomeStats } from "@/lib/home-stats";
import type { Streaks } from "@/lib/streaks";
import { getStreaks } from "@/lib/streaks";
import { loadNutritionDashboard } from "@/lib/nutrition-dashboard";
import type { FitatuDaySummary } from "@/types/fitatu";

/** Z już wczytanych danych Start — bez powtórnego SELECT / dashboardu. */
export function coachRecentContextFromDashboardParts(
  dashToday: Pick<
    FitatuDaySummary,
    "caloriesConsumed" | "caloriesGoal" | "macros" | "macroGoals" | "meals"
  >,
  stats: HomeStats,
  streaks: Streaks,
): NonNullable<ChatCoachPromptInput["recentContext"]> {
  const calConsumed = Math.round(dashToday.caloriesConsumed);
  const calGoal =
    dashToday.caloriesGoal != null ? Math.round(dashToday.caloriesGoal) : null;
  const calRemaining =
    calGoal != null ? Math.round(calGoal - calConsumed) : null;
  const caloriesLine =
    calGoal != null
      ? `${calConsumed} kcal / ${calGoal} kcal (cel), zostaje ${calRemaining} kcal`
      : `${calConsumed} kcal (brak celu)`;

  const p = Math.round(dashToday.macros.protein);
  const f = Math.round(dashToday.macros.fat);
  const c = Math.round(dashToday.macros.carbs);
  const pg = dashToday.macroGoals ? Math.round(dashToday.macroGoals.protein) : null;
  const fg = dashToday.macroGoals ? Math.round(dashToday.macroGoals.fat) : null;
  const cg = dashToday.macroGoals ? Math.round(dashToday.macroGoals.carbs) : null;
  const proteinRemaining = pg != null ? Math.round(pg - p) : null;
  const macrosLine =
    pg != null && fg != null && cg != null
      ? `B ${p}/${pg}g, T ${f}/${fg}g, W ${c}/${cg}g (zostaje białko ${proteinRemaining}g)`
      : `B ${p}g, T ${f}g, W ${c}g`;

  const mealsCount = Array.isArray(dashToday.meals) ? dashToday.meals.length : 0;
  const mealsLine =
    mealsCount > 0
      ? `Posiłki dziś: ${mealsCount} (z dziennika)`
      : "Posiłki dziś: 0 (brak wpisów)";

  const train = stats.lastWorkout
    ? `Ostatni trening ${stats.lastWorkout.date}: „${stats.lastWorkout.title}”, tonaż ${stats.lastWorkout.volumeKg} kg, powt. ${stats.lastWorkout.totalReps}`
    : "Brak zapisanych treningów.";

  const trendLine =
    stats.lastWorkout && stats.deltaVolumePercent != null
      ? `Vs średnia ostatnich sesji: tonaż ${stats.deltaVolumePercent > 0 ? "+" : ""}${stats.deltaVolumePercent}%`
      : "";

  const progressSummary =
    stats.lastWorkout && stats.deltaTotalRepsPercent != null
      ? `Powtórzenia vs średnia: ${stats.deltaTotalRepsPercent > 0 ? "+" : ""}${stats.deltaTotalRepsPercent}%`
      : "";

  const streakLine = `Pasma: trening ${streaks.streak.workoutDays} dni · check-in ${streaks.streak.checkInDays} dni · posiłki ${streaks.streak.mealLoggedDays} dni · waga ${streaks.streak.weighInDays} dni`;

  return {
    nutritionSummary: caloriesLine,
    nutritionMacrosLine: macrosLine,
    nutritionMealsLine: mealsLine,
    trainingSummary: train,
    trainingTrendLine: trendLine || undefined,
    progressSummary: progressSummary || undefined,
    streakLine,
  };
}

export type CoachUserRow = {
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  activityLevel: string | null;
};

export function coachUserProfileFromParts(
  u: CoachUserRow | null | undefined,
  latestReport: LatestBodyReportMetrics | null,
): ChatCoachPromptInput["userProfile"] {
  if (!u) return {};
  return {
    age: u.age ?? undefined,
    weightKg: (latestReport?.weightKg ?? u.weightKg) ?? undefined,
    heightCm: u.heightCm ?? undefined,
    activityLevel: u.activityLevel ?? undefined,
  };
}

export async function buildCoachRecentContext(
  userId: string,
): Promise<NonNullable<ChatCoachPromptInput["recentContext"]>> {
  const db = getDb();
  const [settingsRow] = await db
    .select({
      trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
      restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
      nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const dash = await loadNutritionDashboard(userId, settingsRow);
  const [stats, streaks] = await Promise.all([
    getHomeStats(userId),
    getStreaks(userId, dash.todayKey),
  ]);

  return coachRecentContextFromDashboardParts(
    {
      caloriesConsumed: dash.today.caloriesConsumed,
      caloriesGoal: dash.today.caloriesGoal,
      macros: dash.today.macros,
      macroGoals: dash.today.macroGoals,
      meals: dash.today.meals,
    },
    stats,
    streaks,
  );
}

export async function buildCoachUserProfile(
  userId: string,
): Promise<ChatCoachPromptInput["userProfile"]> {
  const db = getDb();
  const [u, latestReport] = await Promise.all([
    db
      .select({
        age: users.age,
        weightKg: users.weightKg,
        heightCm: users.heightCm,
        activityLevel: users.activityLevel,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0]),
    getLatestBodyReportMetrics(userId),
  ]);

  return coachUserProfileFromParts(u, latestReport);
}
