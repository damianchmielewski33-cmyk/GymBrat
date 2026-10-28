import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { Utensils } from "lucide-react";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { NutritionPlanSection } from "@/components/profile/nutrition-plan-section";
import {
  ProfileBlock,
  ProfileSection,
} from "@/components/profile/profile-ui";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { nutritionSettingsFromDbRow } from "@/lib/nutrition-goals";

export default async function ProfileDietPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const db = getDb();
  const [[s], [u]] = await Promise.all([
    db
      .select({
        trainingNutritionGoalsJson: userSettings.trainingNutritionGoalsJson,
        restNutritionGoalsJson: userSettings.restNutritionGoalsJson,
        nutritionDayTypesJson: userSettings.nutritionDayTypesJson,
        updatedAt: userSettings.updatedAt,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1),
    db
      .select({ age: users.age })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  const nutritionInitial = nutritionSettingsFromDbRow(
    s ?? {
      trainingNutritionGoalsJson: null,
      restNutritionGoalsJson: null,
      nutritionDayTypesJson: null,
    },
  );

  const isMinorAccount = u?.age != null && u.age < 18;
  const expectedUpdatedAt = s?.updatedAt?.toISOString() ?? null;

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Dieta"
        description="Cel kaloryczny dnia oraz makro B/W/T — osobno na dzień treningowy i wolny. Pięć posiłków w Dzienniku dzieli cel równo."
      />
      <ProfileSection
        icon={Utensils}
        title="Plan żywieniowy"
        description="Makro B/W/T. Kalorie liczą się z gramów."
      >
        <ProfileBlock
          title="Cel kaloryczny dnia"
          description="Osobne zestawy na dzień treningowy i wolny. Posiłki dzielą cel dnia równo (5×)."
        >
          <div id="cele-dzienne" className="scroll-mt-24" />
          {isMinorAccount ? (
            <p
              role="note"
              className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-3 text-[13px] leading-relaxed text-amber-100/90"
            >
              Masz mniej niż 18 lat. Przy celu z deficytem kalorycznym
              skonsultuj plan z rodzicem lub dietetykiem — aplikacja nie
              zastępuje porady medycznej.
            </p>
          ) : null}
          <NutritionPlanSection
            initialTraining={nutritionInitial.training}
            initialRest={nutritionInitial.rest}
            initialDayTypes={nutritionInitial.dayTypes}
            expectedUpdatedAt={expectedUpdatedAt}
          />
        </ProfileBlock>
      </ProfileSection>
    </div>
  );
}
