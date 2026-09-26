import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { ProfileGoalForm } from "@/components/profile/profile-goal-form";
import { BodyParamsForm } from "@/components/profile/body-params-form";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { LogoutButton } from "@/components/profile/logout-button";
import { CalendarRange, Dumbbell, ScrollText, Shield, User as UserIcon } from "lucide-react";
import { NutritionPlanSection } from "@/components/profile/nutrition-plan-section";
import { DataRightsCard } from "@/components/profile/data-rights-card";
import { ReminderSettingsCard } from "@/components/profile/reminder-settings-card";
import { nutritionSettingsFromDbRow } from "@/lib/nutrition-goals";
import { parseRemindersJson } from "@/lib/reminders-types";
import { parseMealTemplatesJson } from "@/lib/meal-templates";
import { LocaleSwitchCard } from "@/components/profile/locale-switch-card";
import { AndroidAppVersionCard } from "@/components/android-app-version-card";
import { MealTemplatesCard } from "@/components/profile/meal-templates-card";
import Link from "next/link";
import { redirect } from "next/navigation";

function ProfileSection({
  kicker,
  title,
  description,
  children,
  action,
}: {
  kicker: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-[#141416] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]">
            {kicker}
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-white/45">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

export default async function ProfilePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const db = getDb();

  const [u] = await db
    .select({
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      weightKg: users.weightKg,
      heightCm: users.heightCm,
      age: users.age,
      activityLevel: users.activityLevel,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const [s] = await db
    .select({
      goal: userSettings.weeklyCardioGoalMinutes,
      trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
      restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
      nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
      remindersJson: userSettings.remindersJson,
      mealTemplatesJson: userSettings.mealTemplatesJson,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  const nutritionInitial = nutritionSettingsFromDbRow(
    s ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-start justify-between gap-3 px-0.5 pb-1 pt-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gym-gold)]">
            Zawodnik
          </p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-white">
            Profil
          </h1>
          <p className="mt-2 text-sm text-white/45">
            Ustawienia używane w Pulpicie, Diecie, Treningach i Raportach.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/changelog"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/[0.04] px-4 text-sm font-medium text-white/85 hover:bg-white/[0.08]"
          >
            <ScrollText className="h-4 w-4" aria-hidden />
            Nowości
          </Link>
          <LogoutButton className="h-11 rounded-2xl" />
        </div>
      </header>

      <AndroidAppVersionCard />

      <ProfileSection
        kicker="Konto"
        title="Dane logowania"
        description="Email i nazwa widoczne w aplikacji."
        action={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10">
            <UserIcon className="h-5 w-5 text-[var(--gym-gold)]" />
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#1c1c20] p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">Email</p>
            <p className="mt-1 text-sm font-medium text-white/90">{u?.email}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#1c1c20] p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/40">
              Nazwa wyświetlana
            </p>
            <p className="mt-1 text-sm font-medium text-white/90">{u?.name ?? "—"}</p>
          </div>
        </div>
      </ProfileSection>

      <LocaleSwitchCard />

      <ProfileSection
        kicker="Trening"
        title="Plan treningowy"
        description="Dni i ćwiczenia planu. Start sesji oraz cardio są w zakładce Treningi."
        action={
          <Link
            href="/profile/workout-plan"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#f0d56a] via-[#d4af37] to-[#b8922a] px-4 text-sm font-bold text-[#0a0906]"
          >
            <Dumbbell className="h-4 w-4" aria-hidden />
            Ustaw plan
          </Link>
        }
      />

      <ProfileSection
        kicker="Cardio"
        title="Cel tygodniowy"
        description="Minuty cardio na tydzień — postęp widać na Pulpicie i w Treningach."
      >
        <ProfileGoalForm initialGoal={s?.goal ?? 150} />
      </ProfileSection>

      <ReminderSettingsCard initial={parseRemindersJson(s?.remindersJson ?? null)} />

      <MealTemplatesCard initial={parseMealTemplatesJson(s?.mealTemplatesJson ?? null)} />

      <ProfileSection
        kicker="Dieta"
        title="Cele dzienne trening / odpoczynek"
        description="Kalorie i makro B/W/T dla dni treningowych i wolnych oraz kalendarz typu dnia."
        action={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10">
            <CalendarRange className="h-5 w-5 text-[var(--gym-gold)]" />
          </div>
        }
      >
        <NutritionPlanSection
          initialTraining={nutritionInitial.training}
          initialRest={nutritionInitial.rest}
          initialDayTypes={nutritionInitial.dayTypes}
        />
      </ProfileSection>

      <ProfileSection
        kicker="Pomiary"
        title="Parametry ciała"
        description="Imię, waga, wzrost i aktywność — baza do raportów i pulpitu."
      >
        <BodyParamsForm
          initial={{
            firstName: u?.firstName ?? "",
            lastName: u?.lastName ?? "",
            weightKg: u?.weightKg ?? null,
            heightCm: u?.heightCm ?? null,
            age: u?.age ?? null,
            activityLevel: u?.activityLevel ?? "medium",
          }}
        />
      </ProfileSection>

      <ProfileSection
        kicker="Bezpieczeństwo"
        title="Zmień hasło"
        action={
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10">
            <Shield className="h-5 w-5 text-[var(--gym-gold)]" />
          </div>
        }
      >
        <ChangePasswordForm />
      </ProfileSection>

      <DataRightsCard />
    </div>
  );
}
