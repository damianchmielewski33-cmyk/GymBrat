"use client";

import { useMemo, useState } from "react";
import {
  MEAL_SLOT_LABELS,
  pickCatalogMealsForGaps,
  type CatalogMeal,
} from "@/lib/meal-catalog";
import type { MacroGaps } from "@/lib/meal-suggestions-gaps";
import { RecipeImage } from "@/components/meal-suggestions/recipe-image";
import { calendarDateKey } from "@/lib/local-date";
import { useI18n } from "@/components/i18n/i18n-provider";
import { formatMessage } from "@/lib/i18n/format";
import { Sparkles } from "lucide-react";

export function MealSuggestionsTodayCard({
  gaps,
  catalogMeals,
  onSelectMeal,
}: {
  gaps: MacroGaps;
  catalogMeals: CatalogMeal[];
  onSelectMeal?: (meal: CatalogMeal) => void;
}) {
  const { t } = useI18n();
  const [hour] = useState(() => new Date().getHours());

  const proposals = useMemo(() => {
    if (!catalogMeals.length) return [];
    return pickCatalogMealsForGaps(gaps, {
      hour,
      limit: 4,
      catalog: catalogMeals,
    });
  }, [catalogMeals, gaps, hour]);

  if (catalogMeals.length === 0) return null;

  const isToday = gaps.dateKey === calendarDateKey();
  const title = isToday ? t("diet.proposalsToday") : t("diet.proposalsGaps");

  const remainingBits = [
    gaps.proteinRemaining != null && gaps.proteinRemaining > 0
      ? `${Math.round(gaps.proteinRemaining)} g B`
      : null,
    gaps.carbsRemaining != null && gaps.carbsRemaining > 0
      ? `${Math.round(gaps.carbsRemaining)} g W`
      : null,
    gaps.fatRemaining != null && gaps.fatRemaining > 0
      ? `${Math.round(gaps.fatRemaining)} g T`
      : null,
    gaps.caloriesRemaining != null && gaps.caloriesRemaining > 0
      ? `${Math.round(gaps.caloriesRemaining)} kcal`
      : null,
  ].filter(Boolean);

  const description =
    proposals.length > 0
      ? remainingBits.length > 0
        ? formatMessage(t("diet.proposalsMatchedGaps"), {
            bits: remainingBits.join(" · "),
          })
        : t("diet.proposalsMatchedSlot")
      : t("diet.proposalsNone");

  return (
    <section className="app-card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10">
          <Sparkles className="h-5 w-5 text-[var(--gym-gold)]" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="app-label">{t("diet.proposalsFromCatalog")}</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-white/55">{description}</p>
          <p className="mt-2 text-xs text-white/40">{t("diet.noteCatalogNotAi")}</p>
        </div>
      </div>

      {proposals.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {proposals.map((meal) => (
            <button
              key={meal.id}
              type="button"
              onClick={() => onSelectMeal?.(meal)}
              className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              <div className="relative aspect-[16/10] w-full bg-black/40">
                <RecipeImage recipe={meal} alt={meal.title} />
              </div>
              <div className="space-y-1.5 p-3">
                <p className="line-clamp-2 text-sm font-semibold text-white">{meal.title}</p>
                <p className="text-[11px] text-white/45">{MEAL_SLOT_LABELS[meal.slot]}</p>
                <p className="text-[11px] tabular-nums text-[var(--neon)]">
                  {Math.round(meal.approximateMacros.calories)} kcal · B{" "}
                  {Math.round(meal.approximateMacros.proteinG)} · W{" "}
                  {Math.round(meal.approximateMacros.carbsG)} · T{" "}
                  {Math.round(meal.approximateMacros.fatG)}
                </p>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
