import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { CardioWeekModePicker } from "@/components/profile/cardio-week-mode-picker";
import { ProfileGoalForm } from "@/components/profile/profile-goal-form";
import {
  ProfileBlock,
  ProfileSection,
} from "@/components/profile/profile-ui";
import { ProgressDeltaUnitPicker } from "@/components/profile/progress-delta-unit-picker";
import { ReportCadenceForm } from "@/components/profile/report-cadence-form";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { parseCardioWeekMode } from "@/lib/cardio-week-range";
import { parseProgressDeltaUnit } from "@/lib/progress-delta-unit";

export const metadata = { title: "Trening i postępy" };

export default async function ProfileTrainingPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const db = getDb();
  const [s] = await db
    .select({
      goal: userSettings.weeklyCardioGoalMinutes,
      cardioWeekMode: userSettings.cardioWeekMode,
      reportCadenceDays: userSettings.reportCadenceDays,
      progressDeltaUnit: userSettings.progressDeltaUnit,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Trening i postępy"
        description="Cele tygodniowe i sposób pokazywania zmian."
      />
      <ProfileSection
        icon={Dumbbell}
        title="Ustawienia treningu"
        description="Cel cardio widać na Start i w Treningach."
      >
        <ProfileBlock
          title="Cel cardio"
          description="Minuty cardio na tydzień."
        >
          <ProfileGoalForm initialGoal={s?.goal ?? 150} />
        </ProfileBlock>
        <ProfileBlock
          title="Tydzień cardio"
          description="Jak liczyć minuty do celu: ten sam wybór na Start, w Treningach i w arkuszu cardio."
        >
          <CardioWeekModePicker initialMode={parseCardioWeekMode(s?.cardioWeekMode)} />
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
          <ProgressDeltaUnitPicker
            initialUnit={parseProgressDeltaUnit(s?.progressDeltaUnit)}
          />
        </ProfileBlock>
        <ProfileBlock
          title="Plan treningowy"
          description="Edycja planu jest w osobnym miejscu — linkowane z całej aplikacji."
        >
          <Link
            href="/plany"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/10 px-4 text-[13px] font-semibold text-[var(--gym-gold)] transition-colors hover:bg-[var(--gym-gold)]/18"
          >
            Otwórz plany treningowe
          </Link>
        </ProfileBlock>
      </ProfileSection>
    </div>
  );
}
