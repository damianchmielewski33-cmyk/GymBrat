import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NutritionWeekView } from "@/components/nutrition/nutrition-week-view";
import {
  loadNutritionDashboard,
  loadPreviousWeeksForSheet,
} from "@/lib/nutrition-dashboard";
import { buildWeekNutritionRows } from "@/lib/week-nutrition-rows";

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

  const dash = await loadNutritionDashboard(userId, settingsRow);
  const previousWeeks = await loadPreviousWeeksForSheet(
    userId,
    dash.settings,
    dash.todayKey,
  );
  const dayRows = buildWeekNutritionRows(dash.week.days);

  return (
    <NutritionWeekView
      todayKey={dash.todayKey}
      weekStart={dash.week.weekStart}
      weekEnd={dash.week.weekEnd}
      dayRows={dayRows}
      weekRollup={{
        sumProteinGoal: dash.week.sumProteinGoal,
        sumProteinConsumed: dash.week.sumProteinConsumed,
        sumFatGoal: dash.week.sumFatGoal,
        sumFatConsumed: dash.week.sumFatConsumed,
        sumCarbsGoal: dash.week.sumCarbsGoal,
        sumCarbsConsumed: dash.week.sumCarbsConsumed,
        sumCaloriesGoal: dash.week.sumCaloriesGoal,
        sumCaloriesConsumed: dash.week.sumCaloriesConsumed,
      }}
      previousWeeks={previousWeeks}
    />
  );
}
