"use client";

import { useMemo, useState } from "react";
import {
  ChefHat,
  ChevronDown,
  Search,
  ShoppingBag,
  Star,
  Tag,
} from "lucide-react";
import { RecipeImage } from "@/components/meal-suggestions/recipe-image";
import { DietRecipeFlipCard } from "@/components/meal-suggestions/diet-recipe-flip-card";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import {
  countByDifficulty,
  countByTaste,
  filterCatalogForMealPlan,
  recipeDifficulty,
  RECIPE_CATEGORY_LABELS,
  type MealPlanRow,
  type RecipeCategory,
  type RecipeDifficulty,
  type RecipeTaste,
} from "@/lib/diet-recipe-match";
import {
  addRecipeIngredientsToShoppingList,
  type ShoppingListItem,
} from "@/lib/shopping-list";
import { cn } from "@/lib/utils";

function ChefHats({
  level,
  size = "sm",
  dimRest = true,
}: {
  level: RecipeDifficulty;
  size?: "sm" | "md";
  /** Gdy false — pokazuje tylko `level` czapek (filtry). */
  dimRest?: boolean;
}) {
  const cls = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  const icons = dimRest ? ([1, 2, 3] as const) : ([1, 2, 3] as const).slice(0, level);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {icons.map((i) => (
        <ChefHat
          key={i}
          className={cn(
            cls,
            !dimRest || i <= level
              ? "text-[var(--gym-gold)]"
              : "text-white/20",
          )}
        />
      ))}
    </span>
  );
}

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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums",
        active
          ? "border-[var(--gym-gold)]/55 bg-[var(--gym-gold)]/12 text-[var(--gym-gold)]"
          : "border-white/12 bg-white/[0.03] text-white/60",
      )}
    >
      <ChefHats level={level} size="md" dimRest={false} />
      <span>{count}</span>
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
  const [category, setCategory] = useState<RecipeCategory>("all");
  const [catOpen, setCatOpen] = useState(false);
  const [selected, setSelected] = useState<CatalogMeal | null>(null);

  const forCounts = useMemo(
    () =>
      filterCatalogForMealPlan({
        meals,
        row,
        query: "",
        difficulty: "all",
        taste: "all",
        category: "all",
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
        category,
        limit: 120,
      }),
    [meals, row, query, difficulty, taste, category],
  );

  const categoryLabel =
    category === "all"
      ? "wszystkie"
      : RECIPE_CATEGORY_LABELS[category].toLowerCase();

  return (
    <section className="mt-3 space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gym-gold)]/70" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="danie albo składnik, np. kurczak bez ryżu"
          className="h-11 w-full rounded-full border border-white/10 bg-black/45 py-2 pl-10 pr-3 text-sm text-white outline-none placeholder:text-[var(--gym-gold)]/55"
        />
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
              "rounded-full border px-3.5 py-1.5 text-[12px] font-semibold",
              taste === f.id
                ? "border-[var(--gym-gold)]/60 bg-transparent text-[var(--gym-gold)]"
                : "border-white/14 bg-transparent text-white/70",
            )}
          >
            {f.label} {f.n}
          </button>
        ))}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setCatOpen((v) => !v)}
          className="inline-flex w-full items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-2 text-left text-[12px] font-medium text-white/80"
          aria-expanded={catOpen}
        >
          <Tag className="h-3.5 w-3.5 text-[var(--gym-gold)]" aria-hidden />
          <span className="min-w-0 flex-1 truncate">
            Kategoria: {categoryLabel}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-white/40 transition-transform",
              catOpen && "rotate-180",
            )}
          />
        </button>
        {catOpen ? (
          <ul className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-[#141414] py-1 shadow-xl">
            {(
              [
                "all",
                "mieso",
                "ryby",
                "wege",
                "nabial",
                "inne",
              ] as RecipeCategory[]
            ).map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => {
                    setCategory(id);
                    setCatOpen(false);
                  }}
                  className={cn(
                    "flex w-full px-3.5 py-2.5 text-left text-[13px]",
                    category === id
                      ? "bg-[var(--gym-gold)]/12 text-[var(--gym-gold)]"
                      : "text-white/75 hover:bg-white/[0.04]",
                  )}
                >
                  {id === "all" ? "wszystkie" : RECIPE_CATEGORY_LABELS[id]}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
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

      <p className="px-0.5 text-[12px] font-medium text-white/70">
        {filtered.length} dań
      </p>

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
            const kcal = Math.round(meal.approximateMacros.calories);
            return (
              <div
                key={meal.id}
                className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101010] text-left"
              >
                <div className="relative aspect-square">
                  <button
                    type="button"
                    onClick={() => setSelected(meal)}
                    className="absolute inset-0"
                    aria-label={meal.title}
                  >
                    <RecipeImage
                      recipe={meal}
                      className="h-full w-full object-cover"
                      alt=""
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  </button>
                  <span
                    className="pointer-events-none absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center text-white/85"
                    aria-hidden
                  >
                    <Star className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <button
                    type="button"
                    aria-label={`Dodaj składniki „${meal.title}” do listy zakupów`}
                    onClick={() => {
                      const next = addRecipeIngredientsToShoppingList(meal);
                      onShoppingChange?.(next);
                      notifySaved(`Dodano składniki: ${meal.title}`);
                    }}
                    className="absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-sm hover:bg-black/75"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(meal)}
                  className="w-full space-y-1.5 px-2.5 py-2.5 text-left"
                >
                  <p className="line-clamp-2 min-h-[2.4em] text-[12px] font-semibold leading-snug text-white">
                    {meal.title}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tabular-nums text-white/75">
                      {kcal} kcal
                    </p>
                    <ChefHats level={diff} />
                  </div>
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
