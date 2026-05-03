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
  dashToday: Pick<FitatuDaySummary, "caloriesConsumed" | "caloriesGoal">,
  stats: HomeStats,
  streaks: Streaks,
): NonNullable<ChatCoachPromptInput["recentContext"]> {
  const nut = `${Math.round(dashToday.caloriesConsumed)} kcal / ${
    dashToday.caloriesGoal != null ? Math.round(dashToday.caloriesGoal) : "?"
  } kcal (cel)`;

  const train = stats.lastWorkout
    ? `Ostatni trening ${stats.lastWorkout.date}, objętość ${stats.lastWorkout.volumeKg} kg`
    : "Brak zapisanych treningów.";

  const streakLine = `Pasma: trening ${streaks.streak.workoutDays} dni · check-in ${streaks.streak.checkInDays} dni · posiłki ${streaks.streak.mealLoggedDays} dni`;

  return {
    nutritionSummary: nut,
    trainingSummary: train,
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
