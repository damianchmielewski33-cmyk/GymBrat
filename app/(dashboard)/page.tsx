import { auth } from "@/auth";
import { HomeWorkoutTrendDynamic } from "@/components/home/home-workout-trend-dynamic";
import { LastWorkoutStats } from "@/components/home/last-workout-stats";
import { NutritionProgressBars } from "@/components/home/nutrition-progress-bars";
import { AddMealSheet } from "@/components/home/add-meal-sheet";
import { MealLogsList } from "@/components/home/meal-logs-list";
import { TodaysMacrosSection } from "@/components/home/todays-macros";
import { HomeStartPanels } from "@/components/home/home-start-panels";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { getHomeStats } from "@/lib/home-stats";
import { listMealLogsForDay } from "@/lib/meal-logs";
import {
  loadNutritionDashboard,
  loadPreviousWeeksForSheet,
} from "@/lib/nutrition-dashboard";
import { resolveProfileDayGoals } from "@/lib/nutrition-goals";
import { buildWeekNutritionRows } from "@/lib/week-nutrition-rows";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Zap } from "lucide-react";

function kcalProgress(consumed: number, goal: number) {
  if (!goal || goal <= 0) return { pct: 0, over: false };
  const pct = (consumed / goal) * 100;
  return { pct, over: consumed > goal };
}

export default async function HomePage() {
  const session = await auth().catch((err) => {
    console.error("[home] auth()", err);
    return null;
  });
  const userId = session?.user?.id;
  if (!userId) {
    redirect("/login?callbackUrl=/");
  }

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
  const profileGoalsToday = resolveProfileDayGoals(
    dash.settings,
    dash.todayKey,
  );
  const consumptionHint = profileGoalsToday
    ? "Cele kaloryczne i makroskładniki z profilu (kalendarz treningowy). Spożycie na dziś to suma Twoich ręcznych wpisów posiłków."
    : "Spożycie na dziś liczymy wyłącznie z wpisów posiłków na tej stronie. Cele mogą pochodzić z integracji Fitatu, jeśli ją skonfigurujesz w profilu.";

  const dayG = dash.today.caloriesGoal ?? 0;
  const dayC = dash.today.caloriesConsumed;
  const dayProg = kcalProgress(dayC, dayG);

  const weekG = dash.week.sumCaloriesGoal;
  const weekC = dash.week.sumCaloriesConsumed;
  const weekProg = kcalProgress(weekC, weekG);

  const stats = await getHomeStats(userId);
  const mealEntries = await listMealLogsForDay(userId, dash.todayKey);
  const weekDayRows = buildWeekNutritionRows(dash.week.days);

  const subtitleMacros =
    dash.today.source === "error"
      ? "Sprawdź integrację lub cele w profilu"
      : dayG > 0
        ? `${Math.round(dayC)} / ${Math.round(dayG)} kcal · makroskładniki`
        : `${Math.round(dayC)} kcal spożyte`;

  const subtitleMeals =
    mealEntries.length === 0
      ? `Brak wpisów · ${dash.todayKey}`
      : `${mealEntries.length} wpisów · ${dash.todayKey}`;

  const subtitleTargets =
    weekG > 0
      ? `${dayProg.pct.toFixed(0)}% dziś · ${weekProg.pct.toFixed(0)}% tydzień`
      : `${dayProg.pct.toFixed(0)}% dziś`;

  const subtitleLastWorkout = stats.lastWorkout
    ? `${stats.lastWorkout.title.slice(0, 42)}${stats.lastWorkout.title.length > 42 ? "…" : ""}`
    : "Brak zapisanego treningu";

  const showTrend = stats.trend.length > 0;
  const subtitleTrend = `${stats.trend.length} treningów na wykresie`;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="glass-panel neon-glow relative overflow-hidden px-4 py-7 sm:px-6 sm:py-8 md:p-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--neon)]/10 via-transparent to-transparent" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--neon)]/18 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Start
            </p>
            <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold sm:text-4xl">
              Gotowy na trening?
            </h1>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <AddMealSheet dateKey={dash.todayKey} />
            <Link
              href="/start-workout"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--neon)] px-5 text-sm font-medium text-white transition hover:bg-[#ff4d6d] sm:w-auto"
            >
              <Zap className="mr-2 h-4 w-4" />
              Rozpocznij trening
            </Link>
          </div>
        </div>
      </section>

      <HomeStartPanels
        subtitleMacros={subtitleMacros}
        subtitleMeals={subtitleMeals}
        subtitleTargets={subtitleTargets}
        subtitleLastWorkout={subtitleLastWorkout}
        subtitleTrend={subtitleTrend}
        showTrend={showTrend}
        macrosPanel={
          <TodaysMacrosSection
            data={dash.today}
            consumptionHint={consumptionHint}
            embedded
          />
        }
        mealsPanel={
          <MealLogsList
            entries={mealEntries}
            dateKey={dash.todayKey}
            embedded
          />
        }
        targetsPanel={
          <NutritionProgressBars
            dayLabel="Dziś"
            dayPercent={dayProg.pct}
            dayDetail={
              dayG > 0
                ? `${Math.round(dayC)} / ${Math.round(dayG)} kcal`
                : "Brak dziennego celu kcal — uzupełnij cele w profilu lub korzystaj z celu z Fitatu."
            }
            dayOver={dayProg.over}
            weekLabel="Ten tydzień (pon.–niedz.)"
            weekPercent={weekProg.pct}
            weekDetail={
              weekG > 0
                ? `${Math.round(weekC)} / ${Math.round(weekG)} kcal (wpisy posiłków vs suma celów)`
                : "Brak sumy celów tygodnia — ustaw makroskładniki w profilu dla treningu i odpoczynku."
            }
            weekOver={weekProg.over}
            weekDayRows={weekDayRows}
            sheetTodayKey={dash.todayKey}
            weekNutritionRollup={{
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
        }
        lastWorkoutPanel={<LastWorkoutStats stats={stats} embedded />}
        trendPanel={
          <div className="glass-panel neon-glow relative overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(900px_420px_at_15%_0%,rgba(255,45,85,0.10),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 text-white/50">
                <Activity className="h-4 w-4" />
                <p className="text-[11px] font-medium uppercase tracking-[0.22em]">
                  Trend
                </p>
              </div>
              <h2 className="font-heading mt-1 text-lg font-semibold text-white">
                Ostatnie treningi
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Wolumen (kg) i liczba powtórzeń z ostatnich {stats.trend.length}{" "}
                treningów.
              </p>
              <div className="mt-5">
                <HomeWorkoutTrendDynamic data={stats.trend} />
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
}
