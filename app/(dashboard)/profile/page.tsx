import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Dumbbell, ShieldCheck, Smartphone, User as UserIcon, Utensils } from "lucide-react";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { AndroidAppVersionCard } from "@/components/android-app-version-card";
import { ConsentSettingsCard } from "@/components/consent/consent-settings-card";
import { AppPageHeader } from "@/components/layout/screen";
import { BodyParamsForm } from "@/components/profile/body-params-form";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { LocaleSwitch } from "@/components/profile/locale-switch";
import { LogoutButton } from "@/components/profile/logout-button";
import { MealTemplatesForm } from "@/components/profile/meal-templates-form";
import { NutritionPlanSection } from "@/components/profile/nutrition-plan-section";
import {
  DataExportActions,
  DeleteAccountControl,
} from "@/components/profile/personal-data-card";
import { ProfileGoalForm } from "@/components/profile/profile-goal-form";
import { ProgressDeltaUnitPicker } from "@/components/profile/progress-delta-unit-picker";
import {
  ProfileBlock,
  ProfileNav,
  ProfileSection,
  ProfileStat,
} from "@/components/profile/profile-ui";
import { RemindersCard } from "@/components/profile/reminders-card";
import { ReportCadenceForm } from "@/components/profile/report-cadence-form";
import { mealTemplatesForProfile } from "@/lib/meal-templates";
import { nutritionSettingsFromDbRow } from "@/lib/nutrition-goals";
import { parseProgressDeltaUnit } from "@/lib/progress-delta-unit";
import { parseRemindersJson } from "@/lib/reminders-types";
import { getVapidPublicKey, isWebPushConfigured } from "@/lib/web-push";

function initialsOf(first: string | null, last: string | null, fallback: string): string {
  const letters = `${first?.trim()[0] ?? ""}${last?.trim()[0] ?? ""}`;
  return (letters || fallback.trim()[0] || "?").toUpperCase();
}

export default async function ProfilePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const db = getDb();

  const [userRows, settingsRows] = await Promise.all([
    db
      .select({
        email: users.email,
        name: users.name,
        firstName: users.firstName,
        lastName: users.lastName,
        weightKg: users.weightKg,
        heightCm: users.heightCm,
        age: users.age,
        sex: users.sex,
        activityLevel: users.activityLevel,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({
        goal: userSettings.weeklyCardioGoalMinutes,
        reportCadenceDays: userSettings.reportCadenceDays,
        trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
        restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
        nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
        mealTemplatesJson: userSettings.mealTemplatesJson,
        progressDeltaUnit: userSettings.progressDeltaUnit,
        remindersJson: userSettings.remindersJson,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
  ]);
  const u = userRows[0];
  const s = settingsRows[0];

  const nutritionInitial = nutritionSettingsFromDbRow(
    s ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );

  const displayName =
    [u?.firstName, u?.lastName].filter(Boolean).join(" ").trim() || u?.name || "Zawodnik";
  const hasPassword = Boolean(u?.passwordHash);

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Zawodnik"
        title="Profil"
        description="Ustawienia używane na Start, w Treningach, Diecie i Raportach."
      />

      {/* Tożsamość + szybkie podsumowanie ciała */}
      <section className="app-card-raised p-5 sm:p-6" aria-label="Twoje konto">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/12 font-heading text-xl font-semibold text-[var(--gym-gold)]"
          >
            {initialsOf(u?.firstName ?? null, u?.lastName ?? null, displayName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-white">{displayName}</p>
            <p className="truncate text-[13px] text-white/50">{u?.email}</p>
          </div>
          <LogoutButton className="h-10 shrink-0 rounded-xl px-3 text-[13px]" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <ProfileStat label="Waga" value={u?.weightKg != null ? `${u.weightKg} kg` : "—"} />
          <ProfileStat label="Wzrost" value={u?.heightCm != null ? `${u.heightCm} cm` : "—"} />
          <ProfileStat label="Wiek" value={u?.age != null ? `${u.age} l.` : "—"} />
        </div>
      </section>

      <ProfileNav />

      <ProfileSection
        id="body"
        icon={UserIcon}
        title="Ciało i dane"
        description="Baza do raportów, kalorii z cardio i zapotrzebowania."
      >
        <BodyParamsForm
          initial={{
            firstName: u?.firstName ?? "",
            lastName: u?.lastName ?? "",
            weightKg: u?.weightKg ?? null,
            heightCm: u?.heightCm ?? null,
            age: u?.age ?? null,
            sex: u?.sex ?? null,
            activityLevel: u?.activityLevel ?? "medium",
          }}
        />
      </ProfileSection>

      <ProfileSection
        id="training"
        icon={Dumbbell}
        title="Trening i postępy"
        description="Plan, cele tygodniowe i sposób pokazywania zmian."
      >
        <ProfileBlock
          title="Plan treningowy"
          description="Dni i ćwiczenia planu. Start sesji oraz cardio są w zakładce Treningi."
          action={
            <Link
              href="/profile/workout-plan"
              className="gym-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold sm:w-auto"
            >
              <Dumbbell className="h-4 w-4" aria-hidden />
              Ustaw plan
            </Link>
          }
        />
        <ProfileBlock
          title="Cel cardio"
          description="Minuty cardio na tydzień — postęp widać na Start i w Treningach."
        >
          <ProfileGoalForm initialGoal={s?.goal ?? 150} />
        </ProfileBlock>
        <ProfileBlock
          title="Cykl raportów"
          description="Jak często przypominać o raporcie sylwetki."
        >
          <ReportCadenceForm initialDays={s?.reportCadenceDays ?? 14} />
        </ProfileBlock>
        <ProfileBlock
          title="Jednostka porównań"
          description="Delty tonażu i objętości (Historia, popup po treningu) w % albo w kg."
        >
          <ProgressDeltaUnitPicker initialUnit={parseProgressDeltaUnit(s?.progressDeltaUnit)} />
        </ProfileBlock>
      </ProfileSection>

      <ProfileSection
        id="diet"
        icon={Utensils}
        title="Dieta"
        description="Cele makro oraz podział na 5 stałych posiłków."
      >
        <ProfileBlock
          title="Cele dzienne"
          description="Makro B/W/T dla dni treningowych i wolnych. Kalorie liczą się z gramów."
        >
          <NutritionPlanSection
            initialTraining={nutritionInitial.training}
            initialRest={nutritionInitial.rest}
            initialDayTypes={nutritionInitial.dayTypes}
          />
        </ProfileBlock>
        <ProfileBlock
          title="Makro posiłków"
          description="Ustaw zalecane B/W/T dla Posiłku 1–5 — Dieta dobierze przepisy i przeskaluje gramaturę."
        >
          <MealTemplatesForm initial={mealTemplatesForProfile(s?.mealTemplatesJson ?? null)} />
        </ProfileBlock>
      </ProfileSection>

      <ProfileSection
        id="reminders"
        icon={Bell}
        title="Przypomnienia"
        description="Trening, posiłki i check-in o wybranych porach."
      >
        <RemindersCard
          initial={parseRemindersJson(s?.remindersJson ?? null)}
          vapidPublicKey={isWebPushConfigured() ? getVapidPublicKey() : null}
        />
      </ProfileSection>

      <ProfileSection
        id="app"
        icon={Smartphone}
        title="Aplikacja"
        description="Język interfejsu i wersja aplikacji na telefonie."
      >
        <ProfileBlock
          title="Język interfejsu"
          description="Dotyczy nawigacji i elementów ze słownika — pełne tłumaczenie rozszerzamy stopniowo."
        >
          <LocaleSwitch />
        </ProfileBlock>
        <AndroidAppVersionCard />
      </ProfileSection>

      <ProfileSection
        id="account"
        icon={ShieldCheck}
        title="Konto i prywatność"
        description="Hasło, zgody, eksport i usunięcie danych (RODO)."
      >
        {hasPassword ? (
          <ProfileBlock title="Zmiana hasła">
            <ChangePasswordForm />
          </ProfileBlock>
        ) : null}
        <ProfileBlock
          title="Zgody i cookies"
          description="Opcjonalne kategorie możesz zmienić w każdej chwili."
        >
          <ConsentSettingsCard />
        </ProfileBlock>
        <ProfileBlock
          title="Twoje dane"
          description="Eksport obejmuje dane konta, treningi, dietę i raporty dostępne w aplikacji."
        >
          <DataExportActions />
        </ProfileBlock>
        <ProfileBlock
          tone="danger"
          title="Usuń konto"
          description="Trwale kasuje konto i powiązane dane w GymBrat. Operacji nie można cofnąć."
        >
          <DeleteAccountControl />
        </ProfileBlock>
      </ProfileSection>
    </div>
  );
}
