import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { loadTodaysNutritionSummary } from "@/lib/nutrition-dashboard";
import { computeMacroGaps } from "@/lib/meal-suggestions-gaps";
import { MealSuggestionsView } from "@/components/meal-suggestions/meal-suggestions-view";
import { parseMealTemplatesJson } from "@/lib/meal-templates";

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

  const summary = await loadTodaysNutritionSummary(userId, settingsRow);
  const gaps = computeMacroGaps(summary);

  return (
    <MealSuggestionsView
      initialSummary={summary}
      initialGaps={gaps}
      mealTemplates={parseMealTemplatesJson(settingsRow?.mealTemplatesJson ?? null)}
    />
  );
}
