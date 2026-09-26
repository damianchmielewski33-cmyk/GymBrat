"use client";

import { useMemo, useState } from "react";
import {
  MEAL_CATALOG,
  MEAL_SLOT_LABELS,
  MEAL_SLOTS,
  getMealsBySlot,
  type CatalogMeal,
  type MealSlot,
} from "@/lib/meal-catalog";
import { mealIllustrationUrl } from "@/lib/meal-suggestions-gaps";
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
import type { DietDiarySlot } from "@/lib/diet-diary-slots";
import { Clock3, X } from "lucide-react";
import { cn } from "@/lib/utils";

function catalogSlotToDiary(slot: MealSlot): DietDiarySlot {
  switch (slot) {
    case "sniadanie":
      return "sniadanie";
    case "drugie_sniadanie":
      return "drugie_sniadanie";
    case "obiad":
      return "obiad";
    case "podwieczorek":
      return "przekaska";
    case "kolacja":
      return "lunch";
    default:
      return "obiad";
  }
}

function fmtMacro(n: number, unit: string) {
  return `${Math.round(n * 10) / 10} ${unit}`;
}

export function MealCatalogBrowser({ dateKey }: { dateKey: string }) {
  const [slot, setSlot] = useState<MealSlot>("sniadanie");
  const [query, setQuery] = useState("");
  const [macroFilter, setMacroFilter] = useState<"all" | "high_protein" | "low_calorie">("all");
  const [selected, setSelected] = useState<CatalogMeal | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);

  const slotMeals = useMemo(() => getMealsBySlot(slot), [slot]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slotMeals.filter((m) => {
      if (macroFilter === "high_protein" && m.approximateMacros.proteinG < 25) return false;
      if (macroFilter === "low_calorie" && m.approximateMacros.calories > 450) return false;
      if (!q) return true;
      const hay = `${m.title} ${m.tagline ?? ""} ${m.ingredients.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }, [slotMeals, query, macroFilter]);

  const visible = filtered.slice(0, visibleCount);

  const detail = useMemo(() => {
    if (!selected) return null;
    const enriched = enrichRecipeContent(selected);
    return { meal: selected, ...enriched };
  }, [selected]);

  return (
    <section className="app-card space-y-4 p-5">
      <div>
        <p className="app-label">Katalog posiłków</p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          {MEAL_CATALOG.length} przepisów z makro i instrukcją
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Śniadanie–kolacja: dokładna gramatura składników, krok po kroku jak przygotować porcję.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {MEAL_SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSlot(s);
              setVisibleCount(12);
            }}
            className={
              slot === s
                ? "rounded-full border border-[var(--neon)]/40 bg-[var(--neon)]/15 px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/[0.07]"
            }
          >
            {MEAL_SLOT_LABELS[s]}
            <span className="ml-1 text-white/40">({getMealsBySlot(s).length})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all" as const, label: "Wszystkie" },
              { id: "high_protein" as const, label: "Więcej białka" },
              { id: "low_calorie" as const, label: "Lżejsze" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setMacroFilter(f.id);
                setVisibleCount(12);
              }}
              className={
                macroFilter === f.id
                  ? "rounded-full border border-white/25 bg-white/[0.1] px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-white/10 bg-transparent px-3 py-1.5 text-xs text-white/60"
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisibleCount(12);
          }}
          placeholder="Szukaj w bazie (np. kurczak, owsianka)…"
          className="h-10 border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 sm:max-w-[320px]"
        />
      </div>

      <p className="text-xs text-white/45">
        {MEAL_SLOT_LABELS[slot]}: {filtered.length} z {slotMeals.length} pozycji
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((meal) => (
          <button
            key={meal.id}
            type="button"
            onClick={() => setSelected(meal)}
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            <div className="relative aspect-[16/10] w-full bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element -- zewnętrzny URL ilustracji */}
              <img
                src={mealIllustrationUrl(meal.title, meal.imagePromptEn)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="space-y-2 p-3">
              <p className="line-clamp-2 text-sm font-semibold text-white">{meal.title}</p>
              <p className="text-[11px] tabular-nums text-[var(--neon)]">
                {Math.round(meal.approximateMacros.calories)} kcal · B{" "}
                {Math.round(meal.approximateMacros.proteinG)} · W{" "}
                {Math.round(meal.approximateMacros.carbsG)} · T{" "}
                {Math.round(meal.approximateMacros.fatG)}
              </p>
              <p className="text-[11px] text-white/45">~{meal.prepMinutes} min · zobacz przepis</p>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/45">Brak dań dla tych filtrów.</p>
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
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-white/45">
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mealIllustrationUrl(detail.meal.title, detail.meal.imagePromptEn)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
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
                      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/40">
                        {m.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
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
                    defaultSlot={catalogSlotToDiary(detail.meal.slot)}
                  />
                  <p className="mt-2 text-center text-[10px] text-white/35">
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
