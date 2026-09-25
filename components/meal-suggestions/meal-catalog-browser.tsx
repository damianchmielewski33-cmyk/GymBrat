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

  return (
    <section className="app-card space-y-4 p-5">
      <div>
        <p className="app-label">Katalog posiłków</p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          {MEAL_CATALOG.length} przepisów z makro i instrukcją
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Śniadanie, drugie śniadanie, obiad, podwieczorek i kolacja — każde danie ma makro, składniki
          i krótki przepis.
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
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  {MEAL_SLOT_LABELS[selected.slot]}
                  {selected.tagline ? ` · ${selected.tagline}` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mealIllustrationUrl(selected.title, selected.imagePromptEn)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-white/70">
                  <span className="rounded-full border border-white/15 px-2.5 py-1">
                    {Math.round(selected.approximateMacros.calories)} kcal
                  </span>
                  <span className="rounded-full border border-white/15 px-2.5 py-1">
                    B {fmtMacro(selected.approximateMacros.proteinG, "g")}
                  </span>
                  <span className="rounded-full border border-white/15 px-2.5 py-1">
                    W {fmtMacro(selected.approximateMacros.carbsG, "g")}
                  </span>
                  <span className="rounded-full border border-white/15 px-2.5 py-1">
                    T {fmtMacro(selected.approximateMacros.fatG, "g")}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    Składniki
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-white/80">
                    {selected.ingredients.map((ing) => (
                      <li key={ing}>{ing}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                    Przepis
                  </p>
                  <ol className="mt-2 list-inside list-decimal space-y-2 text-sm text-white/80">
                    {selected.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
                <AddToMealLogSheet
                  dateKey={dateKey}
                  presetName={selected.title}
                  triggerLabel="Dodaj do dziennika"
                  calories={selected.approximateMacros.calories}
                  proteinG={selected.approximateMacros.proteinG}
                  fatG={selected.approximateMacros.fatG}
                  carbsG={selected.approximateMacros.carbsG}
                  defaultSlot={catalogSlotToDiary(selected.slot)}
                />
                <p className="text-[11px] text-white/40">
                  Makro przybliżone dla jednej porcji. Ilustracja syntetyczna na podstawie nazwy dania.
                </p>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}
