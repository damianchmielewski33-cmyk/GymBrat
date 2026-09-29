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
import { loadMergedMealCatalog } from "@/lib/meal-catalog-store";
import { isAdminEligible } from "@/lib/admin-session";

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
  let catalogMeals: Awaited<ReturnType<typeof loadMergedMealCatalog>> = [];
  let summary: Awaited<ReturnType<typeof loadNutritionSummaryForDate>>;
  let adminEligible = false;
  try {
    const loaded = await Promise.all([
      loadNutritionSummaryForDate(userId, todayKey, settingsRow),
      loadMergedMealCatalog(),
      isAdminEligible(session),
    ]);
    summary = loaded[0];
    catalogMeals = loaded[1];
    adminEligible = loaded[2];
  } catch (e) {
    console.error("[meal-suggestions] load failed", e);
    // Nie blokuj całego Jadłospisu — pokaż dziennik bez katalogu.
    summary = await loadNutritionSummaryForDate(userId, todayKey, settingsRow).catch(() => ({
      date: todayKey,
      caloriesConsumed: 0,
      macros: { protein: 0, fat: 0, carbs: 0 },
      meals: [],
      source: "error" as const,
      errorMessage: "Nie udało się wczytać dnia.",
    }));
    catalogMeals = [];
    adminEligible = false;
  }
  const gaps = computeMacroGaps(summary);
  const logs = await listMealLogsForDay(userId, gaps.dateKey).catch(() => []);
  const dayKind = resolveNutritionDayKind(settingsRow, gaps.dateKey);

  return (
    <MealSuggestionsView
      initialSummary={summary}
      initialGaps={gaps}
      initialLogs={logs}
      initialDayKind={dayKind}
      mealTemplates={parseMealTemplatesJson(settingsRow?.mealTemplatesJson ?? null)}
      catalogMeals={catalogMeals}
      isAdmin={adminEligible}
    />
  );
}
