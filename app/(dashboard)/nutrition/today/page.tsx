import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NutritionTodayView } from "@/components/nutrition/nutrition-today-view";
import { loadNutritionWeekHistory } from "@/lib/nutrition-dashboard";
import { nutritionSettingsFromDbRow } from "@/lib/nutrition-goals";
import { calendarDateKey } from "@/lib/local-date";

export default async function NutritionTodayPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/nutrition/today");

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

  const todayKey = calendarDateKey(new Date());
  const settings = nutritionSettingsFromDbRow(
    settingsRow ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );
  const weeks = await loadNutritionWeekHistory(userId, settings, todayKey, 0);
  const currentWeek = weeks[0] ?? null;

  return (
    <NutritionTodayView todayKey={todayKey} currentWeek={currentWeek} />
  );
}
