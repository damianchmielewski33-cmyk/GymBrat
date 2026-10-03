import { Suspense } from "react";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import {
  hasExplicitNutritionDayKind,
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
import { parseDietTab } from "@/lib/diet-tabs";
import { resolveDietSupplementItems } from "@/lib/diet-supplements";

export default async function MealSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/meal-suggestions");

  const sp = await searchParams;
  const initialTab = parseDietTab(sp?.tab);

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
  }
  const gaps = computeMacroGaps(summary);
  const logs = await listMealLogsForDay(userId, gaps.dateKey).catch(() => []);
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
    <Suspense
      fallback={
        <div className="px-1 py-8 text-sm text-white/45">Ładowanie diety…</div>
      }
    >
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
    </Suspense>
  );
}
