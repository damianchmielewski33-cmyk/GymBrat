import { auth } from "@/auth";
import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import {
  Activity,
  Bell,
  Dumbbell,
  KeyRound,
  ShieldCheck,
  Smartphone,
  User,
  Users,
  Utensils,
} from "lucide-react";
import Link from "next/link";
import { LogoutButton } from "@/components/profile/logout-button";
import {
  SettingsGroup,
  SettingsRow,
} from "@/components/profile/settings-list";
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

export const metadata = { title: "Profil" };

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
        email: users.email,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
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

  const reminders = parseRemindersJson(s?.remindersJson ?? null);
  const reminderSlots = [
    Boolean(reminders.workoutTime),
    Boolean(reminders.mealTime),
    Boolean(reminders.checkinTime),
  ];
  const remindersOn = reminderSlots.filter(Boolean).length;

  const displayName =
    [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() ||
    u?.name ||
    "Zawodnik";
  const initials = (
    `${u?.firstName?.trim()[0] ?? ""}${u?.lastName?.trim()[0] ?? ""}` ||
    displayName.trim()[0] ||
    "?"
  ).toUpperCase();

  return (
    <div className="space-y-5">
      <AppPageHeader kicker="Zawodnik" title="Profil" />

      <Link
        href="/profile/body"
        aria-label="Edytuj dane osobowe"
        className="app-card-raised flex items-center gap-4 p-4 transition-colors hover:border-[var(--gym-gold)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50"
      >
        <span
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/12 font-heading text-xl font-semibold text-[var(--gym-gold)]"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold text-white">
            {displayName}
          </span>
          <span className="block truncate text-[13px] text-white/50">
            {u?.email}
          </span>
        </span>
        <span className="shrink-0 text-[12px] font-semibold text-[var(--gym-gold)]">
          Edytuj
        </span>
      </Link>

      <SettingsGroup title="Cele i dane">
        <SettingsRow
          href="/profile/body"
          icon={User}
          title="Ciało i dane"
          value={
            bodyComplete
              ? `${weightLabel}${heightLabel ? ` · ${heightLabel}` : ""}${ageLabel ? ` · ${ageLabel}` : ""}`
              : "Uzupełnij wagę, wzrost i wiek"
          }
        />
        <SettingsRow
          href="/profile/training"
          icon={Dumbbell}
          title="Trening i postępy"
          value={`${planName ? `Plan: ${planName}` : "Brak planu"} · cardio ${s?.goal ?? 150} min/tydz.`}
        />
        <SettingsRow
          href="/profile/diet"
          icon={Utensils}
          title="Dieta"
          value={`${nutrition.training ? `Trening ${nutrition.training.calories} kcal` : "Brak celu treningowego"} · ${nutrition.rest ? `wolny ${nutrition.rest.calories} kcal` : "brak celu wolnego"}`}
        />
        <SettingsRow
          href="/community/teams"
          icon={Users}
          title="Zespół"
          value="Zespoły, wyzwania i społeczność"
        />
      </SettingsGroup>

      <SettingsGroup title="Powiadomienia">
        <SettingsRow
          href="/profile/reminders"
          icon={Bell}
          title="Przypomnienia"
          value={`${remindersOn} z 3 włączone${reminders.emailDailyBrief ? " · e-mail dzienny" : ""}`}
        />
      </SettingsGroup>

      <SettingsGroup title="Prywatność i bezpieczeństwo">
        <SettingsRow
          href="/profile/privacy"
          icon={ShieldCheck}
          title="Prywatność i dane"
          value="Zgody, eksport danych"
        />
        <SettingsRow
          href="/profile/account"
          icon={KeyRound}
          title="Konto i hasło"
          value="Hasło, usunięcie konta"
        />
      </SettingsGroup>

      <SettingsGroup title="Aplikacja">
        <SettingsRow
          href="/profile/app"
          icon={Smartphone}
          title="Aplikacja"
          value="Instalacja i wersja na telefonie"
        />
        <SettingsRow
          href="/pomoc"
          icon={Activity}
          title="Pomoc i reklamacje"
          value="Formularz zgłoszenia, odpowiedź do 14 dni"
        />
      </SettingsGroup>

      <LogoutButton className="h-12 w-full rounded-2xl text-[14px]" />
    </div>
  );
}
