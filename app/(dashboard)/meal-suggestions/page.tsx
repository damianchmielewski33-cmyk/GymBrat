import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { isAiConfigured } from "@/ai/client";
import { loadTodaysNutritionSummary } from "@/lib/nutrition-dashboard";
import { computeMacroGaps } from "@/lib/meal-suggestions-gaps";
import { getUserAiEntitled, getUserAiFeaturesDisabled } from "@/lib/user-ai-preference";
import { MealSuggestionsView } from "@/components/meal-suggestions/meal-suggestions-view";
import { isAiGloballyDisabled } from "@/lib/ai-availability";

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
  const entitled = await getUserAiEntitled(userId);

  const summary = await loadTodaysNutritionSummary(userId, settingsRow);
  const gaps = computeMacroGaps(summary);
  const globalOff = await isAiGloballyDisabled();
  const modelAllowed = isAiConfigured() && entitled && !userAiOff && !globalOff;

  return (
    <MealSuggestionsView
      initialSummary={summary}
      initialGaps={gaps}
      modelAllowed={modelAllowed}
    />
  );
}
