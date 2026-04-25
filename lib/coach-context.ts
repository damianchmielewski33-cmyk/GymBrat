import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import type { ChatCoachPromptInput } from "@/ai/prompts/chatCoach";
import { getHomeStats } from "@/lib/home-stats";
import { getStreaks } from "@/lib/streaks";
import { loadNutritionDashboard } from "@/lib/nutrition-dashboard";
import { getLatestBodyReportMetrics } from "@/lib/body-reports";

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
  const stats = await getHomeStats(userId);
  const streaks = await getStreaks(userId, dash.todayKey);

  const nut = `${Math.round(dash.today.caloriesConsumed)} kcal / ${
    dash.today.caloriesGoal != null ? Math.round(dash.today.caloriesGoal) : "?"
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

  if (!u) return {};
  return {
    age: u.age ?? undefined,
    weightKg: (latestReport?.weightKg ?? u.weightKg) ?? undefined,
    heightCm: u.heightCm ?? undefined,
    activityLevel: u.activityLevel ?? undefined,
  };
}
