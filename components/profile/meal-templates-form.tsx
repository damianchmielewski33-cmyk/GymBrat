"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveMealTemplatesAction } from "@/actions/meal-quick";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  ProfileChipGroup,
  ProfileComputedValue,
  ProfileField,
} from "@/components/profile/profile-ui";
import { Button } from "@/components/ui/button";
import {
  kcalFromMacros,
  MEAL_SUM_TOLERANCE_PCT,
  parseMacroGrams,
} from "@/lib/kcal-from-macros";
import {
  defaultMealTemplateName,
  MEAL_TEMPLATE_COUNT,
  mealTemplatesDaySum,
  normalizeMealTemplates,
  type MealDayType,
  type MealTemplate,
  type MealTemplatesByDayType,
} from "@/lib/meal-templates";
import type { NutritionGoalsPayload } from "@/lib/nutrition-goals";

type DraftMeal = {
  id: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

function toDraft(t: MealTemplate): DraftMeal {
  const hasMacros =
    t.proteinG > 0 || t.carbsG > 0 || t.fatG > 0 || t.calories > 0;
  const fmt = (n: number) => (hasMacros ? String(Math.round(n * 10) / 10) : "");
  return {
    id: t.id,
    proteinG: fmt(t.proteinG),
    carbsG: fmt(t.carbsG),
    fatG: fmt(t.fatG),
  };
}

function draftsFromTemplates(initial: MealTemplate[]): DraftMeal[] {
  return normalizeMealTemplates(initial).map(toDraft);
}

function draftsToTemplates(meals: DraftMeal[]): MealTemplate[] {
  return meals.map((m, i) => {
    const proteinG = parseMacroGrams(m.proteinG);
    const carbsG = parseMacroGrams(m.carbsG);
    const fatG = parseMacroGrams(m.fatG);
    return {
      id: m.id,
      name: defaultMealTemplateName(i + 1),
      calories: kcalFromMacros(proteinG, fatG, carbsG),
      proteinG,
      fatG,
      carbsG,
    };
  });
}

export function MealTemplatesForm({
  initial,
  goals,
  expectedUpdatedAt,
}: {
  initial: MealTemplatesByDayType;
  goals?: {
    training: NutritionGoalsPayload | null;
    rest: NutritionGoalsPayload | null;
  };
  expectedUpdatedAt?: string | null;
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [dayType, setDayType] = useState<MealDayType>("training");
  const [training, setTraining] = useState(() =>
    draftsFromTemplates(initial.training),
  );
  const [rest, setRest] = useState(() => draftsFromTemplates(initial.rest));

  useEffect(() => {
    setTraining(draftsFromTemplates(initial.training));
    setRest(draftsFromTemplates(initial.rest));
  }, [initial]);

  const meals = dayType === "training" ? training : rest;
  const setMeals = dayType === "training" ? setTraining : setRest;

  const dayTotals = useMemo(() => {
    const templates = draftsToTemplates(meals);
    return mealTemplatesDaySum(templates);
  }, [meals]);

  const goalKcal =
    dayType === "training"
      ? goals?.training?.calories ?? null
      : goals?.rest?.calories ?? null;

  const sumWarning = useMemo(() => {
    if (goalKcal == null || goalKcal <= 0) {
      return "Ustaw cel dnia, aby zobaczyć porównanie";
    }
    if (dayTotals.calories <= 0) return null;
    const diff = dayTotals.calories - goalKcal;
    const pct = (Math.abs(diff) / goalKcal) * 100;
    if (pct <= MEAL_SUM_TOLERANCE_PCT) return null;
    const dir = diff > 0 ? "wyższa" : "niższa";
    const dayLabel =
      dayType === "training" ? "treningowego" : "wolnego";
    return `Suma posiłków (${dayTotals.calories} kcal) jest o ${Math.abs(diff)} kcal (${Math.round(pct)}%) ${dir} niż cel dnia ${dayLabel} (${goalKcal} kcal)`;
  }, [dayTotals.calories, goalKcal, dayType]);

  function updateMeal(
    id: string,
    patch: Partial<Pick<DraftMeal, "proteinG" | "carbsG" | "fatG">>,
  ) {
    setMeals((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }

  function save() {
    start(async () => {
      const payload: MealTemplatesByDayType = {
        training: draftsToTemplates(training),
        rest: draftsToTemplates(rest),
      };
      const r = await saveMealTemplatesAction(payload, expectedUpdatedAt);
      if (r.ok) {
        notifySaved("Makro posiłków zapisane.");
        router.refresh();
      } else if (r.error === "conflict") {
        notifyError(
          "Te ustawienia zmieniono z innego urządzenia — odśwież stronę.",
        );
      } else {
        notifyError(r.error || "Nie udało się zapisać.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <ProfileChipGroup
        aria-label="Typ dnia dla makro posiłków"
        value={dayType}
        onChange={(v) => setDayType(v as MealDayType)}
        options={[
          { value: "training", label: "Dzień treningowy" },
          { value: "rest", label: "Dzień wolny" },
        ]}
      />

      <ProfileComputedValue
        label={`Suma dnia (${MEAL_TEMPLATE_COUNT} posiłków)`}
        value={
          <>
            {Math.round(dayTotals.proteinG)}B · {Math.round(dayTotals.carbsG)}W ·{" "}
            {Math.round(dayTotals.fatG)}T
            <span className="ml-2 text-white/90">
              {dayTotals.calories}{" "}
              <span className="text-sm font-normal text-white/45">kcal</span>
            </span>
          </>
        }
        hint={
          sumWarning ? (
            <span>
              {sumWarning}
              {goalKcal == null ? (
                <>
                  {" "}
                  —{" "}
                  <a
                    href="#cele-dzienne"
                    className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
                  >
                    Cele dzienne
                  </a>
                </>
              ) : null}
            </span>
          ) : null
        }
      />

      <ul className="space-y-3">
        {meals.map((m, index) => {
          const kcal = kcalFromMacros(
            parseMacroGrams(m.proteinG),
            parseMacroGrams(m.fatG),
            parseMacroGrams(m.carbsG),
          );
          return (
            <li
              key={`${dayType}-${m.id}`}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-semibold text-[var(--gym-gold)]">
                  {defaultMealTemplateName(index + 1)}
                </p>
                <p className="text-xs tabular-nums text-white/45">
                  ≈ {kcal} kcal
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <ProfileField label="Białko (g)" htmlFor={`meal-p-${m.id}`}>
                  <InputMacro
                    id={`meal-p-${m.id}`}
                    value={m.proteinG}
                    onChange={(v) => updateMeal(m.id, { proteinG: v })}
                    placeholder="40"
                  />
                </ProfileField>
                <ProfileField label="Węgle (g)" htmlFor={`meal-c-${m.id}`}>
                  <InputMacro
                    id={`meal-c-${m.id}`}
                    value={m.carbsG}
                    onChange={(v) => updateMeal(m.id, { carbsG: v })}
                    placeholder="20"
                  />
                </ProfileField>
                <ProfileField label="Tłuszcz (g)" htmlFor={`meal-f-${m.id}`}>
                  <InputMacro
                    id={`meal-f-${m.id}`}
                    value={m.fatG}
                    onChange={(v) => updateMeal(m.id, { fatG: v })}
                    placeholder="10"
                  />
                </ProfileField>
              </div>
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="cta"
        disabled={pending}
        className="w-full"
        onClick={save}
      >
        {pending ? "Zapisywanie…" : "Zapisz makro posiłków"}
      </Button>
    </div>
  );
}

function InputMacro({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      id={id}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 min-h-11 w-full rounded-lg border border-white/20 bg-black/50 px-3 text-base text-white outline-none transition-colors focus-visible:border-[var(--neon)]/55 focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708] md:text-sm"
    />
  );
}
