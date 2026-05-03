import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { isAiConfigured } from "@/ai/client";
import { loadTodaysNutritionSummary } from "@/lib/nutrition-dashboard";
import { computeMacroGaps } from "@/lib/meal-suggestions-gaps";
import { getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import { MealSuggestionsView } from "@/components/meal-suggestions/meal-suggestions-view";

export default async function MealSuggestionsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/meal-suggestions");

  const db = getDb();
  const [[settingsRow], userAiOff] = await Promise.all([
    db
      .select({
        trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
        restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
        nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    getUserAiFeaturesDisabled(userId),
  ]);

  const summary = await loadTodaysNutritionSummary(userId, settingsRow);
  const gaps = computeMacroGaps(summary);
  const modelAllowed = isAiConfigured() && !userAiOff;

  return (
    <MealSuggestionsView
      initialSummary={summary}
      initialGaps={gaps}
      modelAllowed={modelAllowed}
    />
  );
}
