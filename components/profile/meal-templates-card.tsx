"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { saveMealTemplatesAction } from "@/actions/meal-quick";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { kcalFromMacros } from "@/lib/kcal-from-macros";
import {
  defaultMealTemplateName,
  MAX_MEAL_TEMPLATES,
  type MealTemplate,
} from "@/lib/meal-templates";
import { cn } from "@/lib/utils";

type DraftMeal = {
  id: string;
  name: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

function toDraft(t: MealTemplate): DraftMeal {
  return {
    id: t.id,
    name: t.name,
    proteinG: String(Math.round(t.proteinG * 10) / 10),
    carbsG: String(Math.round(t.carbsG * 10) / 10),
    fatG: String(Math.round(t.fatG * 10) / 10),
  };
}

function emptyDraft(index: number): DraftMeal {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `meal_${Date.now()}_${index}`,
    name: defaultMealTemplateName(index),
    proteinG: "",
    carbsG: "",
    fatG: "",
  };
}

function parseGrams(raw: string): number {
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function MealTemplatesCard({ initial }: { initial: MealTemplate[] }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [meals, setMeals] = useState<DraftMeal[]>(() =>
    initial.length > 0
      ? initial.slice(0, MAX_MEAL_TEMPLATES).map(toDraft)
      : [emptyDraft(1)],
  );

  useEffect(() => {
    setMeals(
      initial.length > 0
        ? initial.slice(0, MAX_MEAL_TEMPLATES).map(toDraft)
        : [emptyDraft(1)],
    );
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

  function updateMeal(id: string, patch: Partial<DraftMeal>) {
    setMeals((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  }

  function addMeal() {
    if (meals.length >= MAX_MEAL_TEMPLATES) return;
    setMeals((prev) => [...prev, emptyDraft(prev.length + 1)]);
  }

  function removeMeal(id: string) {
    setMeals((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((m) => m.id !== id);
    });
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
              Zdefiniuj ile posiłków jesz dziennie (max {MAX_MEAL_TEMPLATES}) i
              makro każdego z nich. Dieta zaproponuje przepisy z takimi makro —
              gramatura składników jest skalowana do Twojego celu.
            </p>
          </div>
          <UtensilsCrossed
            className="h-5 w-5 shrink-0 text-[var(--neon)]"
            aria-hidden
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Suma dnia ({meals.length} posiłków)
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
            return (
              <li
                key={m.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
                    Posiłek {index + 1}
                  </p>
                  <button
                    type="button"
                    disabled={meals.length <= 1 || pending}
                    onClick={() => removeMeal(m.id)}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 text-white/55",
                      meals.length <= 1 && "opacity-30",
                    )}
                    aria-label={`Usuń posiłek ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`meal-name-${m.id}`}>Nazwa</Label>
                    <Input
                      id={`meal-name-${m.id}`}
                      value={m.name}
                      onChange={(e) =>
                        updateMeal(m.id, { name: e.target.value })
                      }
                      placeholder={defaultMealTemplateName(index + 1)}
                    />
                  </div>
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

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending || meals.length >= MAX_MEAL_TEMPLATES}
            onClick={addMeal}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Dodaj posiłek
            {meals.length < MAX_MEAL_TEMPLATES
              ? ` (${meals.length}/${MAX_MEAL_TEMPLATES})`
              : ` (max ${MAX_MEAL_TEMPLATES})`}
          </Button>
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
                  if (calories <= 0 && proteinG + carbsG + fatG <= 0) {
                    notifyError(
                      `Posiłek ${i + 1}: podaj makro (białko / węgle / tłuszcz).`,
                    );
                    return;
                  }
                  templates.push({
                    id: m.id,
                    name: m.name.trim() || defaultMealTemplateName(i + 1),
                    calories,
                    proteinG,
                    fatG,
                    carbsG,
                  });
                }
                const r = await saveMealTemplatesAction(templates);
                if (r.ok) {
                  notifySaved("Posiłki zapisane.");
                  router.refresh();
                } else {
                  notifyError(r.error || "Nie udało się zapisać.");
                }
              });
            }}
          >
            Zapisz posiłki
          </Button>
        </div>
      </div>
    </section>
  );
}
