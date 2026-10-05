"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { UtensilsCrossed } from "lucide-react";
import { saveMealTemplatesAction } from "@/actions/meal-quick";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { kcalFromMacros } from "@/lib/kcal-from-macros";
import {
  defaultMealTemplateName,
  MEAL_TEMPLATE_COUNT,
  normalizeMealTemplates,
  type MealTemplate,
} from "@/lib/meal-templates";

type DraftMeal = {
  id: string;
  name: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

function toDraft(t: MealTemplate): DraftMeal {
  const hasMacros = t.proteinG > 0 || t.carbsG > 0 || t.fatG > 0 || t.calories > 0;
  return {
    id: t.id,
    name: t.name,
    proteinG: hasMacros ? String(Math.round(t.proteinG * 10) / 10) : "",
    carbsG: hasMacros ? String(Math.round(t.carbsG * 10) / 10) : "",
    fatG: hasMacros ? String(Math.round(t.fatG * 10) / 10) : "",
  };
}

function draftsFromTemplates(initial: MealTemplate[]): DraftMeal[] {
  return normalizeMealTemplates(initial).map(toDraft);
}

function parseGrams(raw: string): number {
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function MealTemplatesCard({ initial }: { initial: MealTemplate[] }) {
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
    return {
      proteinG,
      carbsG,
      fatG,
      calories: kcalFromMacros(proteinG, fatG, carbsG),
    };
  }, [meals]);

  function updateMeal(id: string, patch: Partial<Pick<DraftMeal, "proteinG" | "carbsG" | "fatG">>) {
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  return (
    <section className="glass-panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:radial-gradient(520px_220px_at_80%_100%,rgba(255,45,85,0.10),transparent_55%)]" />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
              Dieta
            </p>
            <h2 className="font-heading mt-2 text-xl font-semibold">
              Posiłki i makro
            </h2>
            <p className="mt-2 text-sm text-white/60">
              Masz {MEAL_TEMPLATE_COUNT} stałych posiłków (Posiłek 1–{MEAL_TEMPLATE_COUNT}).
              Ustaw tylko zalecane makro B/W/T — nazwy i liczba slotów są stałe. Dieta
              dobierze przepisy i przeskaluje gramaturę do tych celów.
            </p>
          </div>
          <UtensilsCrossed
            className="h-5 w-5 shrink-0 text-[var(--neon)]"
            aria-hidden
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Suma dnia ({MEAL_TEMPLATE_COUNT} posiłków)
          </p>
          <p className="mt-1.5 font-medium tabular-nums text-white/90">
            {Math.round(dayTotals.proteinG)}B · {Math.round(dayTotals.carbsG)}W ·{" "}
            {Math.round(dayTotals.fatG)}T · {dayTotals.calories} kcal
          </p>
        </div>

        <ul className="space-y-4">
          {meals.map((m, index) => {
            const p = parseGrams(m.proteinG);
            const c = parseGrams(m.carbsG);
            const f = parseGrams(m.fatG);
            const kcal = kcalFromMacros(p, f, c);
            const label = defaultMealTemplateName(index + 1);
            return (
              <li
                key={m.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
                  {label}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`meal-p-${m.id}`}>Białko (g)</Label>
                    <Input
                      id={`meal-p-${m.id}`}
                      inputMode="decimal"
                      value={m.proteinG}
                      onChange={(e) =>
                        updateMeal(m.id, { proteinG: e.target.value })
                      }
                      placeholder="np. 40"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`meal-c-${m.id}`}>Węglowodany (g)</Label>
                    <Input
                      id={`meal-c-${m.id}`}
                      inputMode="decimal"
                      value={m.carbsG}
                      onChange={(e) =>
                        updateMeal(m.id, { carbsG: e.target.value })
                      }
                      placeholder="np. 20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`meal-f-${m.id}`}>Tłuszcz (g)</Label>
                    <Input
                      id={`meal-f-${m.id}`}
                      inputMode="decimal"
                      value={m.fatG}
                      onChange={(e) =>
                        updateMeal(m.id, { fatG: e.target.value })
                      }
                      placeholder="np. 10"
                    />
                  </div>
                  <div className="flex items-end">
                    <p className="pb-2 text-sm tabular-nums text-white/55">
                      ≈ {kcal} kcal
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <Button
          type="button"
          disabled={pending}
          variant="cta"
          onClick={() => {
            start(async () => {
              const templates: MealTemplate[] = [];
              for (let i = 0; i < meals.length; i++) {
                const m = meals[i]!;
                const proteinG = parseGrams(m.proteinG);
                const carbsG = parseGrams(m.carbsG);
                const fatG = parseGrams(m.fatG);
                const calories = kcalFromMacros(proteinG, fatG, carbsG);
                templates.push({
                  id: m.id,
                  name: defaultMealTemplateName(i + 1),
                  calories,
                  proteinG,
                  fatG,
                  carbsG,
                });
              }
              const r = await saveMealTemplatesAction(templates);
              if (r.ok) {
                notifySaved("Makro posiłków zapisane.");
                router.refresh();
              } else {
                notifyError(r.error || "Nie udało się zapisać.");
              }
            });
          }}
        >
          Zapisz makro
        </Button>
      </div>
    </section>
  );
}
