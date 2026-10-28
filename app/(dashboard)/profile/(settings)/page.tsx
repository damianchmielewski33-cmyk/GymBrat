import { auth } from "@/auth";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { ProfileOverviewCard } from "@/components/profile/profile-ui";
import { getDb } from "@/db";
import { userSettings, users, workoutPlans } from "@/db/schema";
import {
  formatCurrentWeightLabel,
  getCurrentWeightKg,
} from "@/lib/current-weight";
import { calendarDateKey } from "@/lib/local-date";
import { nutritionSettingsFromDbRow } from "@/lib/nutrition-goals";
import { parseRemindersJson } from "@/lib/reminders-types";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";

export default async function ProfileOverviewPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const db = getDb();
  const today = calendarDateKey();

  const [userRows, settingsRows, planRows, currentWeight] = await Promise.all([
    db
      .select({
        weightKg: users.weightKg,
        heightCm: users.heightCm,
        age: users.age,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({
        goal: userSettings.weeklyCardioGoalMinutes,
        trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
        restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
        nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
        remindersJson: userSettings.remindersJson,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    db
      .select({
        planJson: workoutPlans.planJson,
      })
      .from(workoutPlans)
      .where(eq(workoutPlans.userId, userId))
      .orderBy(asc(workoutPlans.sortOrder))
      .limit(1),
    getCurrentWeightKg(userId),
  ]);

  const u = userRows[0];
  const s = settingsRows[0];
  let planName: string | null = null;
  if (planRows[0]?.planJson) {
    try {
      const plan = normalizeWorkoutPlan(
        JSON.parse(planRows[0].planJson) as unknown,
      );
      planName = plan?.planName?.trim() || null;
    } catch {
      planName = null;
    }
  }

  const weightLabel = formatCurrentWeightLabel(currentWeight, today);
  const heightLabel =
    u?.heightCm != null ? `${u.heightCm} cm` : null;
  const ageLabel = u?.age != null ? `${u.age} l.` : null;
  const bodyComplete =
    currentWeight != null && u?.heightCm != null && u?.age != null;

  const nutrition = nutritionSettingsFromDbRow(
    s ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );
  const dietMealsHint = "5 posiłków dzielą cel dnia równo";

  const reminders = parseRemindersJson(s?.remindersJson ?? null);
  const reminderSlots = [
    Boolean(reminders.workoutTime),
    Boolean(reminders.mealTime),
    Boolean(reminders.checkinTime),
  ];
  const remindersOn = reminderSlots.filter(Boolean).length;

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Zawodnik"
        title="Profil"
        description="Przegląd ustawień — otwórz sekcję, którą chcesz zmienić."
      />

      <div className="space-y-2.5">
        <ProfileOverviewCard
          href="/profile/body"
          title="Ciało i dane"
          cta={bodyComplete ? "Edytuj" : "Uzupełnij"}
          summary={
            bodyComplete ? (
              <span>
                {weightLabel}
                {heightLabel ? ` · ${heightLabel}` : ""}
                {ageLabel ? ` · ${ageLabel}` : ""}
              </span>
            ) : (
              <span>Uzupełnij dane — waga, wzrost i wiek</span>
            )
          }
        />

        <ProfileOverviewCard
          href="/profile/training"
          title="Trening i postępy"
          summary={
            <span>
              {planName
                ? `Plan: ${planName}`
                : "Brak planu — ustaw w Plany treningowe"}
              {" · "}
              Cel cardio: {s?.goal ?? 150} min/tydz.
            </span>
          }
        />

        <ProfileOverviewCard
          href="/profile/diet"
          title="Dieta"
          summary={
            <span>
              {nutrition.training
                ? `Trening ${nutrition.training.calories} kcal`
                : "Brak celu treningowego"}
              {" · "}
              {nutrition.rest
                ? `Wolny ${nutrition.rest.calories} kcal`
                : "Brak celu wolnego"}
              <br />
              {dietMealsHint}
            </span>
          }
        />

        <ProfileOverviewCard
          href="/profile/reminders"
          title="Przypomnienia"
          summary={
            <span>
              {remindersOn} z 3 włączone
              {reminders.emailDailyBrief ? " · e-mail dzienny" : ""}
            </span>
          }
        />

        <ProfileOverviewCard
          href="/profile/app"
          title="Aplikacja"
          summary="Język interfejsu i instalacja na telefonie"
        />

        <ProfileOverviewCard
          href="/profile/account"
          title="Konto i prywatność"
          summary="Hasło, zgody, eksport i usunięcie konta"
        />
      </div>
    </div>
  );
}
