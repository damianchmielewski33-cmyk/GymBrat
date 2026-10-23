"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveMealTemplatesAction } from "@/actions/meal-quick";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { ProfileField } from "@/components/profile/profile-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { kcalFromMacros } from "@/lib/kcal-from-macros";
import {
  defaultMealTemplateName,
  MEAL_TEMPLATE_COUNT,
  normalizeMealTemplates,
  type MealTemplate,
} from "@/lib/meal-templates";

type DraftMeal = {
  id: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

function toDraft(t: MealTemplate): DraftMeal {
  const hasMacros = t.proteinG > 0 || t.carbsG > 0 || t.fatG > 0 || t.calories > 0;
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

function parseGrams(raw: string): number {
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function MealTemplatesForm({ initial }: { initial: MealTemplate[] }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [meals, setMeals] = useState<DraftMeal[]>(() => draftsFromTemplates(initial));

  useEffect(() => {
    setMeals(draftsFromTemplates(initial));
  }, [initial]);

  const dayTotals = useMemo(() => {
    let proteinG = 0;
    let carbsG = 0;
    let fatG = 0;
    for (const m of meals) {
      proteinG += parseGrams(m.proteinG);
      carbsG += parseGrams(m.carbsG);
      fatG += parseGrams(m.fatG);
    }
    return { proteinG, carbsG, fatG, calories: kcalFromMacros(proteinG, fatG, carbsG) };
  }, [meals]);

  function updateMeal(
    id: string,
    patch: Partial<Pick<DraftMeal, "proteinG" | "carbsG" | "fatG">>,
  ) {
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function save() {
    start(async () => {
      const templates: MealTemplate[] = meals.map((m, i) => {
        const proteinG = parseGrams(m.proteinG);
        const carbsG = parseGrams(m.carbsG);
        const fatG = parseGrams(m.fatG);
        return {
          id: m.id,
          name: defaultMealTemplateName(i + 1),
          calories: kcalFromMacros(proteinG, fatG, carbsG),
          proteinG,
          fatG,
          carbsG,
        };
      });
      const r = await saveMealTemplatesAction(templates);
      if (r.ok) {
        notifySaved("Makro posiłków zapisane.");
        router.refresh();
      } else {
        notifyError(r.error || "Nie udało się zapisać.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 rounded-xl border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/[0.06] px-4 py-3">
        <div className="min-w-0">
          <p className="app-label">Suma dnia ({MEAL_TEMPLATE_COUNT} posiłków)</p>
          <p className="mt-1 text-sm font-medium tabular-nums text-white/85">
            {Math.round(dayTotals.proteinG)}B · {Math.round(dayTotals.carbsG)}W ·{" "}
            {Math.round(dayTotals.fatG)}T
          </p>
        </div>
        <p className="font-heading text-xl font-semibold tabular-nums text-white">
          {dayTotals.calories} <span className="text-sm text-white/45">kcal</span>
        </p>
      </div>

      <ul className="space-y-3">
        {meals.map((m, index) => {
          const kcal = kcalFromMacros(
            parseGrams(m.proteinG),
            parseGrams(m.fatG),
            parseGrams(m.carbsG),
          );
          return (
            <li key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-semibold text-[var(--gym-gold)]">
                  {defaultMealTemplateName(index + 1)}
                </p>
                <p className="text-xs tabular-nums text-white/45">≈ {kcal} kcal</p>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <ProfileField label="Białko (g)" htmlFor={`meal-p-${m.id}`}>
                  <Input
                    id={`meal-p-${m.id}`}
                    inputMode="decimal"
                    value={m.proteinG}
                    onChange={(e) => updateMeal(m.id, { proteinG: e.target.value })}
                    placeholder="40"
                  />
                </ProfileField>
                <ProfileField label="Węgle (g)" htmlFor={`meal-c-${m.id}`}>
                  <Input
                    id={`meal-c-${m.id}`}
                    inputMode="decimal"
                    value={m.carbsG}
                    onChange={(e) => updateMeal(m.id, { carbsG: e.target.value })}
                    placeholder="20"
                  />
                </ProfileField>
                <ProfileField label="Tłuszcz (g)" htmlFor={`meal-f-${m.id}`}>
                  <Input
                    id={`meal-f-${m.id}`}
                    inputMode="decimal"
                    value={m.fatG}
                    onChange={(e) => updateMeal(m.id, { fatG: e.target.value })}
                    placeholder="10"
                  />
                </ProfileField>
              </div>
            </li>
          );
        })}
      </ul>

      <Button type="button" variant="cta" disabled={pending} className="w-full" onClick={save}>
        {pending ? "Zapisywanie…" : "Zapisz makro posiłków"}
      </Button>
    </div>
  );
}
