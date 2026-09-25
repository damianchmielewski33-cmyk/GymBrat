import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import {
  loadNutritionSummaryForDate,
  resolveNutritionDayKind,
} from "@/lib/nutrition-dashboard";
import { computeMacroGaps } from "@/lib/meal-suggestions-gaps";
import { listMealLogsForDay } from "@/lib/meal-logs";
import { MealSuggestionsView } from "@/components/meal-suggestions/meal-suggestions-view";
import { parseMealTemplatesJson } from "@/lib/meal-templates";
import { calendarDateKey } from "@/lib/local-date";

export default async function MealSuggestionsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/meal-suggestions");

  const db = getDb();
  const [settingsRow] = await db
    .select({
      trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
      restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
      nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
      mealTemplatesJson: userSettings.mealTemplatesJson,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const todayKey = calendarDateKey(new Date());
  const summary = await loadNutritionSummaryForDate(userId, todayKey, settingsRow);
  const gaps = computeMacroGaps(summary);
  const logs = await listMealLogsForDay(userId, gaps.dateKey);
  const dayKind = resolveNutritionDayKind(settingsRow, gaps.dateKey);

  return (
    <MealSuggestionsView
      initialSummary={summary}
      initialGaps={gaps}
      initialLogs={logs}
      initialDayKind={dayKind}
      mealTemplates={parseMealTemplatesJson(settingsRow?.mealTemplatesJson ?? null)}
    />
  );
}
