import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { Utensils } from "lucide-react";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { MealTemplatesForm } from "@/components/profile/meal-templates-form";
import { NutritionPlanSection } from "@/components/profile/nutrition-plan-section";
import {
  ProfileBlock,
  ProfileSection,
} from "@/components/profile/profile-ui";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { mealTemplatesForProfile } from "@/lib/meal-templates";
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
        mealTemplatesJson: userSettings.mealTemplatesJson,
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
        description="Cele makro oraz podział na 5 stałych posiłków — osobno na dzień treningowy i wolny."
      />
      <ProfileSection
        icon={Utensils}
        title="Plan żywieniowy"
        description="Makro B/W/T. Kalorie liczą się z gramów."
      >
        <ProfileBlock
          title="Cele dzienne"
          description="Osobne zestawy na dzień treningowy i wolny."
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
        <ProfileBlock
          title="Makro posiłków"
          description="Zalecane B/W/T dla Posiłku 1–5 — osobno na trening i dzień wolny. Dieta dobierze przepisy i przeskaluje gramaturę."
        >
          <MealTemplatesForm
            initial={mealTemplatesForProfile(s?.mealTemplatesJson ?? null)}
            goals={{
              training: nutritionInitial.training,
              rest: nutritionInitial.rest,
            }}
            expectedUpdatedAt={expectedUpdatedAt}
          />
        </ProfileBlock>
      </ProfileSection>
    </div>
  );
}
