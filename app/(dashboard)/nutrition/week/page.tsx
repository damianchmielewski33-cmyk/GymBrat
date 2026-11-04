import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NutritionWeekView } from "@/components/nutrition/nutrition-week-view";
import {
  loadNutritionWeekRange,
  NUTRITION_WEEK_INITIAL_WEEKS,
} from "@/lib/nutrition-dashboard";
import { nutritionSettingsFromDbRow } from "@/lib/nutrition-goals";
import { calendarDateKey } from "@/lib/local-date";

export const metadata = { title: "Bilans tygodnia" };

export default async function NutritionWeekPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/nutrition/week");

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
  // Z70: tylko pierwsza porcja tygodni; starsze doładowuje klient (loadMoreNutritionWeeks).
  const weeks = await loadNutritionWeekRange(
    userId,
    settings,
    todayKey,
    0,
    NUTRITION_WEEK_INITIAL_WEEKS,
  );

  return <NutritionWeekView todayKey={todayKey} weeks={weeks} />;
}
