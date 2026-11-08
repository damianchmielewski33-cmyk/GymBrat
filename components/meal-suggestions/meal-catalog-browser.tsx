"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MEAL_SLOT_LABELS,
  MEAL_SLOTS,
  getMealsBySlot,
  type CatalogMeal,
  type MealSlot,
} from "@/lib/meal-catalog";
import { RecipeImage } from "@/components/meal-suggestions/recipe-image";
import {
  enrichRecipeContent,
  splitIngredientDisplay,
} from "@/lib/meal-recipe-enrich";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AddToMealLogSheet } from "@/components/meal-suggestions/add-to-meal-log-sheet";
import { MealCatalogEmptyState } from "@/components/meal-suggestions/meal-catalog-empty-state";
import type { DietDiarySlot } from "@/lib/diet-diary-slots";
import { catalogSlotToDiary, diarySlotToCatalog } from "@/lib/diet-slot-map";
import { Clock3, X } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtMacro(n: number, unit: string) {
  return `${Math.round(n * 10) / 10} ${unit}`;
}

export function MealCatalogBrowser({
  dateKey,
  meals,
  isAdmin = false,
  focusMealId = null,
  onFocusMealHandled,
  /** Slot z Jadłospisu — ustawia filtr katalogu i domyślną sekcję przy dodaniu. */
  defaultDiarySlot = null,
}: {
  dateKey: string;
  meals: CatalogMeal[];
  isAdmin?: boolean;
  focusMealId?: string | null;
  onFocusMealHandled?: () => void;
  defaultDiarySlot?: DietDiarySlot | null;
}) {
  const [slot, setSlot] = useState<MealSlot>(() =>
    defaultDiarySlot ? diarySlotToCatalog(defaultDiarySlot) : "sniadanie",
  );
  const [query, setQuery] = useState("");
  const [macroFilter, setMacroFilter] = useState<"all" | "high_protein" | "low_calorie">("all");
  const [selected, setSelected] = useState<CatalogMeal | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);

  useEffect(() => {
    if (!defaultDiarySlot) return;
    setSlot(diarySlotToCatalog(defaultDiarySlot));
    setVisibleCount(12);
  }, [defaultDiarySlot]);

  useEffect(() => {
    if (!focusMealId) return;
    const meal = meals.find((m) => m.id === focusMealId) ?? null;
    if (meal) {
      setSelected(meal);
      setSlot(meal.slot);
    }
    onFocusMealHandled?.();
  }, [focusMealId, meals, onFocusMealHandled]);

  const slotMeals = useMemo(() => getMealsBySlot(slot, meals), [slot, meals]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slotMeals.filter((m) => {
      if (macroFilter === "high_protein" && m.approximateMacros.proteinG < 25) return false;
      if (macroFilter === "low_calorie" && m.approximateMacros.calories > 450) return false;
      if (!q) return true;
      const hay = `${m.title} ${m.tagline ?? ""} ${(Array.isArray(m.ingredients) ? m.ingredients : []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [slotMeals, query, macroFilter]);

  const visible = filtered.slice(0, visibleCount);

  const detail = useMemo(() => {
    if (!selected) return null;
    const enriched = enrichRecipeContent(selected);
    return { meal: selected, ...enriched };
  }, [selected]);

  if (meals.length === 0) {
    return <MealCatalogEmptyState isAdmin={isAdmin} />;
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3 px-0.5">
        <h2 className="text-[17px] font-semibold text-white">Katalog posiłków</h2>
        <p className="text-[12px] tabular-nums text-white/50">
          {filtered.length} z {slotMeals.length}
        </p>
      </div>

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
        {MEAL_SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={slot === s}
            onClick={() => {
              setSlot(s);
              setVisibleCount(12);
            }}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors",
              slot === s
                ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15 font-semibold text-[var(--gym-gold)]"
                : "border-white/[0.1] bg-white/[0.03] font-medium text-white/65",
            )}
          >
            {MEAL_SLOT_LABELS[s]}
            <span className="text-[11px] tabular-nums opacity-60">
              {getMealsBySlot(s, meals).length}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisibleCount(12);
          }}
          placeholder="Szukaj: kurczak, owsianka…"
          aria-label="Szukaj przepisu"
          className="h-11 min-w-0 flex-1 border-white/12 bg-white/[0.05] text-white placeholder:text-white/50"
        />
        <div className="flex shrink-0 gap-1 rounded-full border border-white/[0.1] bg-white/[0.03] p-1">
          {(
            [
              { id: "all" as const, label: "Wszystko" },
              { id: "high_protein" as const, label: "Białko" },
              { id: "low_calorie" as const, label: "Lekkie" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={macroFilter === f.id}
              onClick={() => {
                setMacroFilter(f.id);
                setVisibleCount(12);
              }}
              className={cn(
                "min-h-9 rounded-full px-2.5 text-[12px] transition-colors",
                macroFilter === f.id
                  ? "bg-white/[0.12] font-semibold text-white"
                  : "text-white/55",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {visible.map((meal) => (
          <button
            key={meal.id}
            type="button"
            onClick={() => setSelected(meal)}
            className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left transition-colors active:bg-white/[0.06]"
          >
            <div className="relative aspect-[4/3] w-full bg-black/40">
              <RecipeImage recipe={meal} alt={meal.title} />
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--gym-gold)] backdrop-blur">
                {Math.round(meal.approximateMacros.calories)} kcal
              </span>
            </div>
            <div className="space-y-1 p-2.5">
              <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-white">
                {meal.title}
              </p>
              <p className="text-[11px] tabular-nums text-white/55">
                B {Math.round(meal.approximateMacros.proteinG)} · W{" "}
                {Math.round(meal.approximateMacros.carbsG)} · T{" "}
                {Math.round(meal.approximateMacros.fatG)}
                <span className="text-white/55"> · {meal.prepMinutes} min</span>
              </p>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/50">Brak dań dla tych filtrów.</p>
      ) : null}

      {visibleCount < filtered.length ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => setVisibleCount((n) => n + 12)}
          >
            Pokaż więcej ({filtered.length - visibleCount} pozostało)
          </Button>
        </div>
      ) : null}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex h-full w-full max-w-[100vw] flex-col gap-0 overflow-hidden border-white/10 bg-[#07070c] p-0 text-white sm:max-w-md"
        >
          {detail ? (
            <>
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] px-5 pb-4 pt-5">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
                    {MEAL_SLOT_LABELS[detail.meal.slot]}
                  </p>
                  <SheetHeader className="space-y-1 p-0 text-left">
                    <SheetTitle className="font-heading text-xl font-semibold leading-snug text-white">
                      {detail.meal.title}
                    </SheetTitle>
                    {detail.meal.tagline ? (
                      <SheetDescription className="text-sm text-white/50">
                        {detail.meal.tagline}
                      </SheetDescription>
                    ) : null}
                  </SheetHeader>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/50">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    ok. {detail.meal.prepMinutes} min · 1 porcja
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80"
                  aria-label="Zamknij"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-black/40">
                  <RecipeImage recipe={detail.meal} alt={detail.meal.title} />
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {(
                    [
                      {
                        label: "kcal",
                        value: String(Math.round(detail.meal.approximateMacros.calories)),
                      },
                      {
                        label: "białko",
                        value: fmtMacro(detail.meal.approximateMacros.proteinG, "g"),
                      },
                      {
                        label: "węgle",
                        value: fmtMacro(detail.meal.approximateMacros.carbsG, "g"),
                      },
                      {
                        label: "tłuszcz",
                        value: fmtMacro(detail.meal.approximateMacros.fatG, "g"),
                      },
                    ] as const
                  ).map((m) => (
                    <div
                      key={m.label}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-2.5 text-center"
                    >
                      <p className="font-display text-sm tabular-nums text-[var(--gym-gold)]">
                        {m.value}
                      </p>
                      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/50">
                        {m.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Składniki · gramatura
                  </p>
                  <ul className="mt-3 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-[#121214]">
                    {detail.ingredients.map((ing) => {
                      const { amount, name } = splitIngredientDisplay(ing);
                      return (
                        <li
                          key={ing}
                          className="flex items-start gap-3 px-3.5 py-3 text-sm leading-snug"
                        >
                          <span className="w-[5.5rem] shrink-0 font-mono text-[12px] tabular-nums text-[var(--gym-gold)]">
                            {amount}
                          </span>
                          <span className="min-w-0 flex-1 text-white/85">{name}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-6 pb-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
                    Jak przygotować
                  </p>
                  <ol className="mt-3 space-y-3">
                    {detail.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                            "border border-[rgba(var(--neon-rgb),0.35)] bg-[var(--gym-gold)]/10",
                            "text-xs font-semibold tabular-nums text-[var(--gym-gold)]",
                          )}
                        >
                          {i + 1}
                        </span>
                        <p className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed text-white/80">
                          {step}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="sticky bottom-0 border-t border-white/[0.08] bg-[#07070c]/95 pb-2 pt-3 backdrop-blur">
                  <AddToMealLogSheet
                    dateKey={dateKey}
                    presetName={detail.meal.title}
                    triggerLabel="Dodaj do dziennika"
                    calories={detail.meal.approximateMacros.calories}
                    proteinG={detail.meal.approximateMacros.proteinG}
                    fatG={detail.meal.approximateMacros.fatG}
                    carbsG={detail.meal.approximateMacros.carbsG}
                    defaultSlot={
                      defaultDiarySlot ?? catalogSlotToDiary(detail.meal.slot)
                    }
                  />
                  <p className="mt-2 text-center text-[10px] text-white/50">
                    Makro przybliżone dla jednej porcji. Odważ składniki wagą kuchenną.
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
