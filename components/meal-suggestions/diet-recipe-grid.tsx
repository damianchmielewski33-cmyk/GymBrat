"use client";

import { useMemo, useState } from "react";
import { Search, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { RecipeImage } from "@/components/meal-suggestions/recipe-image";
import { DietRecipeFlipCard } from "@/components/meal-suggestions/diet-recipe-flip-card";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import {
  countByDifficulty,
  countByTaste,
  filterCatalogForMealPlan,
  formatMealMacroLine,
  ingredientPreview,
  recipeDifficulty,
  type MealPlanRow,
  type RecipeDifficulty,
  type RecipeTaste,
} from "@/lib/diet-recipe-match";
import {
  addRecipeIngredientsToShoppingList,
  type ShoppingListItem,
} from "@/lib/shopping-list";
import { cn } from "@/lib/utils";

function HatsFilter({
  level,
  count,
  active,
  onClick,
}: {
  level: RecipeDifficulty;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
        active
          ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
          : "border-white/12 bg-white/[0.04] text-white/55",
      )}
    >
      <span aria-hidden>{"👨‍🍳".repeat(level)}</span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

export function DietRecipeGrid({
  meals,
  row,
  dateKey,
  onShoppingChange,
}: {
  meals: CatalogMeal[];
  row: MealPlanRow;
  dateKey: string;
  onShoppingChange?: (items: ShoppingListItem[]) => void;
}) {
  const { notifySaved } = useSaveFeedback();
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<RecipeDifficulty | "all">("all");
  const [taste, setTaste] = useState<RecipeTaste>("all");
  const [selected, setSelected] = useState<CatalogMeal | null>(null);

  const forCounts = useMemo(
    () =>
      filterCatalogForMealPlan({
        meals,
        row,
        query: "",
        difficulty: "all",
        taste: "all",
        limit: 500,
      }),
    [meals, row],
  );

  const diffCounts = useMemo(() => countByDifficulty(forCounts), [forCounts]);
  const tasteCounts = useMemo(() => countByTaste(forCounts), [forCounts]);

  const filtered = useMemo(
    () =>
      filterCatalogForMealPlan({
        meals,
        row,
        query,
        difficulty,
        taste,
        limit: 120,
      }),
    [meals, row, query, difficulty, taste],
  );

  return (
    <section className="mt-4 space-y-3">
      <div className="flex items-center gap-2 px-0.5">
        <UtensilsCrossed className="h-4 w-4 text-[var(--gym-gold)]" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
          Dania na {row.label} · {filtered.length}
        </h3>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="danie albo składnik"
          className="h-11 w-full rounded-xl border border-white/12 bg-black/40 py-2 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {([1, 2, 3] as const).map((lvl) => (
          <HatsFilter
            key={lvl}
            level={lvl}
            count={diffCounts[lvl]}
            active={difficulty === lvl}
            onClick={() =>
              setDifficulty((prev) => (prev === lvl ? "all" : lvl))
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all" as const, label: "Wszystkie", n: tasteCounts.all },
            { id: "savory" as const, label: "Słone", n: tasteCounts.savory },
            { id: "sweet" as const, label: "Słodkie", n: tasteCounts.sweet },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTaste(f.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
              taste === f.id
                ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                : "border-white/12 bg-white/[0.04] text-white/55",
            )}
          >
            {f.label} {f.n}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/40">
          {meals.length === 0
            ? "Brak przepisów w katalogu — wgraj JSON w panelu admina."
            : "Brak dań dla tych filtrów."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((meal) => {
            const diff = recipeDifficulty(meal.prepMinutes);
            const macros = meal.approximateMacros;
            return (
              <div
                key={meal.id}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#141414] text-left"
              >
                <button
                  type="button"
                  onClick={() => setSelected(meal)}
                  className="w-full text-left"
                >
                  <div className="relative aspect-[4/3]">
                    <RecipeImage
                      recipe={meal}
                      className="h-full w-full object-cover"
                      alt={meal.title}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-2.5 pr-11">
                      <p className="line-clamp-2 text-[11px] font-bold uppercase leading-snug tracking-wide text-[var(--gym-gold)]">
                        {meal.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/70">
                        {ingredientPreview(meal, 4)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1 px-2.5 py-2.5">
                    <p className="line-clamp-2 text-xs font-semibold text-white">
                      {meal.title}
                    </p>
                    <p className="text-[11px] font-semibold tabular-nums text-white/70">
                      {formatMealMacroLine({
                        proteinG: macros.proteinG,
                        carbsG: macros.carbsG,
                        fatG: macros.fatG,
                      })}
                    </p>
                    <p className="text-[11px] tabular-nums text-white/45">
                      {Math.round(macros.calories)} kcal
                    </p>
                    <div className="flex gap-0.5 pt-0.5" aria-hidden>
                      {[1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            "text-[10px]",
                            i <= diff ? "opacity-100" : "opacity-25",
                          )}
                        >
                          👨‍🍳
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Dodaj składniki „${meal.title}” do listy zakupów`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = addRecipeIngredientsToShoppingList(meal);
                    onShoppingChange?.(next);
                    notifySaved(`Dodano składniki: ${meal.title}`);
                  }}
                  className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-[var(--gym-gold)] backdrop-blur-sm hover:bg-black/75"
                >
                  <ShoppingBag className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <DietRecipeFlipCard
        meal={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        dateKey={dateKey}
        diarySlot={row.diarySlot}
      />
    </section>
  );
}
