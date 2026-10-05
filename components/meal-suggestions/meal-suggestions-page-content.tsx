import type { Session } from "next-auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { MealSuggestionsView } from "@/components/meal-suggestions/meal-suggestions-view";
import {
  hasExplicitNutritionDayKind,
  loadNutritionSummaryForDate,
  resolveNutritionDayKind,
} from "@/lib/nutrition-dashboard";
import { computeMacroGaps } from "@/lib/meal-suggestions-gaps";
import { listMealLogsForDay } from "@/lib/meal-logs";
import { parseMealTemplatesJson } from "@/lib/meal-templates";
import { calendarDateKey } from "@/lib/local-date";
import { loadMergedMealCatalog } from "@/lib/meal-catalog-store";
import { isAdminEligible } from "@/lib/admin-session";
import type { DietTabId } from "@/lib/diet-tabs";
import { resolveDietSupplementItems } from "@/lib/diet-supplements";

export async function MealSuggestionsPageContent({
  userId,
  session,
  initialTab,
}: {
  userId: string;
  session: Session;
  initialTab: DietTabId;
}) {
  const db = getDb();
  const [settingsRow] = await db
    .select({
      trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
      restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
      nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
      mealTemplatesJson: userSettings.mealTemplatesJson,
      fitnessGoalsJson: userSettings.fitnessGoalsJson,
      weeklyCardioGoalMinutes: userSettings.weeklyCardioGoalMinutes,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const todayKey = calendarDateKey(new Date());
  let catalogMeals: Awaited<ReturnType<typeof loadMergedMealCatalog>> = [];
  let summary: Awaited<ReturnType<typeof loadNutritionSummaryForDate>>;
  let adminEligible = false;
  let logs: Awaited<ReturnType<typeof listMealLogsForDay>> = [];

  try {
    const loaded = await Promise.all([
      loadNutritionSummaryForDate(userId, todayKey, settingsRow),
      loadMergedMealCatalog(),
      isAdminEligible(session),
      listMealLogsForDay(userId, todayKey).catch(() => []),
    ]);
    summary = loaded[0];
    catalogMeals = loaded[1];
    adminEligible = loaded[2];
    logs = loaded[3];
  } catch (e) {
    console.error("[meal-suggestions] load failed", e);
    summary = await loadNutritionSummaryForDate(userId, todayKey, settingsRow).catch(
      () => ({
        date: todayKey,
        caloriesConsumed: 0,
        macros: { protein: 0, fat: 0, carbs: 0 },
        meals: [],
        source: "error" as const,
        errorMessage: "Nie udało się wczytać dnia.",
      }),
    );
    catalogMeals = [];
    adminEligible = false;
    logs = await listMealLogsForDay(userId, todayKey).catch(() => []);
  }

  const gaps = computeMacroGaps(summary);
  if (gaps.dateKey !== todayKey) {
    logs = await listMealLogsForDay(userId, gaps.dateKey).catch(() => logs);
  }
  const dayKind = resolveNutritionDayKind(settingsRow, gaps.dateKey);
  const dayKindExplicit = hasExplicitNutritionDayKind(
    settingsRow,
    gaps.dateKey,
  );
  const supplements = resolveDietSupplementItems(
    settingsRow?.fitnessGoalsJson,
    settingsRow?.mealTemplatesJson,
  );
  const weeklyCardioGoalMinutes =
    settingsRow?.weeklyCardioGoalMinutes ?? 150;

  return (
    <MealSuggestionsView
      initialSummary={summary}
      initialGaps={gaps}
      initialLogs={logs}
      initialDayKind={dayKind}
      initialDayKindExplicit={dayKindExplicit}
      mealTemplates={parseMealTemplatesJson(
        settingsRow?.mealTemplatesJson ?? null,
      )}
      catalogMeals={catalogMeals}
      isAdmin={adminEligible}
      supplements={supplements}
      weeklyCardioGoalMinutes={weeklyCardioGoalMinutes}
      initialTab={initialTab}
    />
  );
}
