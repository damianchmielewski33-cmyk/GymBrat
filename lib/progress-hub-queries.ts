import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { dailyCheckins, userSettings, users, workoutPlans, workouts } from "@/db/schema";
import { getBodyReports } from "@/lib/body-reports";
import { addCalendarDays } from "@/lib/local-date";

/** Zapytania bazowe Postępów (Z88a). */
/** Równoległe zapytania bazowe dla zakładek Postępów. */
export async function loadProgressHubRows(args: {
  userId: string;
  today: string;
  from180: string;
  wantsStrength: boolean;
  wantsBody: boolean;
  wantsIntelligence: boolean;
  scope: string;
}) {
  const { userId, today, from180, wantsStrength, wantsBody, wantsIntelligence, scope } = args;
  const db = getDb();
  return Promise.all([
    db
      .select({
        weeklyCardioGoalMinutes: userSettings.weeklyCardioGoalMinutes,
        fitnessGoalsJson: userSettings.fitnessGoalsJson,
        trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
        restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
        nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
        startPhotoDataUrl: userSettings.startPhotoDataUrl,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1)
      .then((r) => r[0] ?? null),
    wantsStrength ? db
      .select({
        id: workoutPlans.id,
        planJson: workoutPlans.planJson,
        updatedAt: workoutPlans.updatedAt,
      })
      .from(workoutPlans)
      .where(eq(workoutPlans.userId, userId))
      .orderBy(desc(workoutPlans.updatedAt)) : Promise.resolve([]),
    scope !== "sylwetka" ? db
      .select({
        id: workouts.id,
        date: workouts.date,
        cardioMinutes: workouts.cardioMinutes,
        exercises: workouts.exercises,
        workoutPlanId: workouts.workoutPlanId,
      })
      .from(workouts)
      .where(and(eq(workouts.userId, userId), gte(workouts.date, from180)))
      .orderBy(desc(workouts.date), desc(workouts.id))
      .limit(400) : Promise.resolve([]),
    // Body reports bez metadanych zdjęć; metadata są ładowane osobną akcją.
    wantsBody ? getBodyReports(userId, { photos: "none" }) : Promise.resolve([]),
    wantsIntelligence ? db
      .select({
        age: users.age,
        weightKg: users.weightKg,
        sex: users.sex,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((r) => r[0] ?? null) : Promise.resolve(null),
    wantsIntelligence ? db
      .select({
        date: dailyCheckins.date,
        sleepQuality: dailyCheckins.sleepQuality,
        dayEnergy: dailyCheckins.dayEnergy,
        stress: dailyCheckins.stress,
        weightKg: dailyCheckins.weightKg,
      })
      .from(dailyCheckins)
      .where(
        and(
          eq(dailyCheckins.userId, userId),
          gte(dailyCheckins.date, addCalendarDays(today, -21)),
        ),
      )
      .orderBy(desc(dailyCheckins.date))
      .limit(21) : Promise.resolve([]),
  ]);
}
