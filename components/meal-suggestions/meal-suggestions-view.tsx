"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { FitatuDaySummary } from "@/types/fitatu";
import type { MacroGaps } from "@/lib/meal-suggestions-gaps";
import { mealIllustrationUrl } from "@/lib/meal-suggestions-gaps";
import type { MealSuggestionItem } from "@/lib/meal-suggestions-schema";
import { generateMealSuggestionsAction } from "@/actions/meal-suggestions";
import { AddToMealLogSheet } from "@/components/meal-suggestions/add-to-meal-log-sheet";
import { MealCatalogBrowser } from "@/components/meal-suggestions/meal-catalog-browser";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { ChefHat, Loader2 } from "lucide-react";
import type { MealTemplate } from "@/lib/meal-templates";

function fmtVal(n: number, kind: "kcal" | "g") {
  if (!Number.isFinite(n)) return "—";
  if (kind === "kcal") return `${Math.round(n)} kcal`;
  return `${Math.round(n * 10) / 10} g`;
}

function fmtRem(n: number | null, kind: "kcal" | "g") {
  if (n == null) return "—";
  return fmtVal(n, kind);
}

function GapRow({
  label,
  consumed,
  goal,
  remaining,
  kind,
}: {
  label: string;
  consumed: number;
  goal: number | null;
  remaining: number | null;
  kind: "kcal" | "g";
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm sm:grid-cols-4">
      <span className="font-medium text-white/90">{label}</span>
      <span className="text-white/60">
        Spożyte: <span className="text-white/85">{fmtVal(consumed, kind)}</span>
      </span>
      <span className="text-white/60">
        Cel: <span className="text-white/85">{goal != null ? fmtVal(goal, kind) : "—"}</span>
      </span>
      <span className="text-[var(--neon)]">
        Zostało: <span className="font-semibold">{fmtRem(remaining, kind)}</span>
      </span>
    </div>
  );
}

function fmtMacro(n: number, unit: string) {
  return `${Math.round(n * 10) / 10} ${unit}`;
}

export function MealSuggestionsView({
  initialSummary,
  initialGaps,
  mealTemplates = [],
}: {
  initialSummary: FitatuDaySummary;
  initialGaps: MacroGaps;
  mealTemplates?: MealTemplate[];
}) {
  const [gaps, setGaps] = useState(initialGaps);
  const [meals, setMeals] = useState<MealSuggestionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cacheKeyRef = useRef(`meal-suggestions:catalog:${initialGaps.dateKey}`);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(cacheKeyRef.current);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { meals?: MealSuggestionItem[] };
      if (Array.isArray(parsed.meals) && parsed.meals.length > 0) {
        setMeals(parsed.meals);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function pickFromCatalog() {
    setError(null);
    start(async () => {
      const r = await generateMealSuggestionsAction();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMeals(r.meals);
      setGaps(r.gaps);
      try {
        localStorage.setItem(cacheKeyRef.current, JSON.stringify({ meals: r.meals }));
      } catch {
        /* ignore */
      }
    });
  }

  return (
    <div className="space-y-3">
      <header className="px-0.5 pb-1 pt-2">
        <p className="app-label">Dieta</p>
        <h1 className="mt-2 text-[32px] font-semibold leading-tight text-white">
          Twój plan żywieniowy
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Przepisy i propozycje dnia pochodzą z katalogu GymBrat — wybierz danie i dodaj do dziennika.
        </p>
      </header>

      <section className="app-card p-5">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-[var(--neon)]" aria-hidden />
              <h2 className="text-lg font-semibold text-white">Dziś</h2>
            </div>
            <Button type="button" variant="cta" disabled={pending} onClick={() => pickFromCatalog()}>
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Dobieram…
                </>
              ) : (
                "Propozycje na dziś"
              )}
            </Button>
          </div>

          {initialSummary.source === "error" ? (
            <InlineBanner variant="warning">
              {initialSummary.errorMessage ?? "Nie udało się pobrać danych odżywczych."}
            </InlineBanner>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="app-label">Białko</p>
                  <p className="app-value mt-2 text-[28px] font-semibold">
                    {gaps.proteinGoal != null ? `${Math.round(gaps.proteinGoal)}` : "—"}
                    <span className="ml-1 text-sm text-white/35">g</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="app-label">Węgle</p>
                  <p className="app-value mt-2 text-[28px] font-semibold">
                    {gaps.carbsGoal != null ? `${Math.round(gaps.carbsGoal)}` : "—"}
                    <span className="ml-1 text-sm text-white/35">g</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="app-label">Tłuszcz</p>
                  <p className="app-value mt-2 text-[28px] font-semibold">
                    {gaps.fatGoal != null ? `${Math.round(gaps.fatGoal)}` : "—"}
                    <span className="ml-1 text-sm text-white/35">g</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="app-label">Kalorie</p>
                  <p className="app-value mt-2 text-[28px] font-semibold">
                    {gaps.caloriesGoal != null ? `${Math.round(gaps.caloriesGoal)}` : "—"}
                    <span className="ml-1 text-sm text-white/35">kcal</span>
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <GapRow
                  label="Kalorie"
                  consumed={gaps.caloriesConsumed}
                  goal={gaps.caloriesGoal}
                  remaining={gaps.caloriesRemaining}
                  kind="kcal"
                />
                <GapRow
                  label="Białko"
                  consumed={gaps.proteinConsumed}
                  goal={gaps.proteinGoal}
                  remaining={gaps.proteinRemaining}
                  kind="g"
                />
                <GapRow
                  label="Tłuszcz"
                  consumed={gaps.fatConsumed}
                  goal={gaps.fatGoal}
                  remaining={gaps.fatRemaining}
                  kind="g"
                />
                <GapRow
                  label="Węglowodany"
                  consumed={gaps.carbsConsumed}
                  goal={gaps.carbsGoal}
                  remaining={gaps.carbsRemaining}
                  kind="g"
                />
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.05] pt-4">
            <p className="app-label">Rozkład posiłków</p>
            <p className="mt-2 text-sm text-white/45">
              Poniżej pełna baza — wybierz porę dnia i przepis.
            </p>
            <div className="mt-3 divide-y divide-white/[0.05]">
              {(mealTemplates.length > 0
                ? mealTemplates
                : initialSummary.meals.map((m, i) => ({
                    id: m.id,
                    name: m.name || `Posiłek ${i + 1}`,
                    calories: m.calories,
                    proteinG: m.proteinG,
                    fatG: m.fatG,
                    carbsG: m.carbsG,
                  }))
              ).map((meal, i) => (
                <div key={meal.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {i + 1}. {meal.name}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs tabular-nums text-[var(--neon)]">
                    {Math.round(meal.proteinG)}B · {Math.round(meal.carbsG)}W · {Math.round(meal.fatG)}T
                  </p>
                </div>
              ))}
              {mealTemplates.length === 0 && initialSummary.meals.length === 0 ? (
                <p className="py-3 text-sm text-white/40">
                  Dodaj szablony posiłków w profilu albo wpisz posiłek w dzienniku.
                </p>
              ) : null}
            </div>
          </div>

          {!gaps.hasAnyMacroGoal ? (
            <p className="text-sm text-white/55">
              Uzupełnij cele kaloryczne i makro w{" "}
              <a href="/profile" className="text-[var(--neon)] underline-offset-4 hover:underline">
                profilu
              </a>
              , żeby propozycje na dziś lepiej domykały braki makro.
            </p>
          ) : null}

          {error ? <p className="text-sm text-amber-200">{error}</p> : null}
        </div>
      </section>

      <MealCatalogBrowser dateKey={gaps.dateKey} />

      {meals && meals.length > 0 ? (
        <section className="space-y-3">
          <div className="px-0.5">
            <p className="app-label">Na teraz</p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Propozycje dopasowane do makro
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Cztery dania dopasowane do pory dnia oraz braków białka, węgli i tłuszczu.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {meals.map((meal, idx) => (
              <article
                key={`${meal.title}-${idx}`}
                className="glass-panel relative flex flex-col overflow-hidden border border-white/[0.08]"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40">
                  {/* eslint-disable-next-line @next/next/no-img-element -- zewnętrzny URL ilustracji */}
                  <img
                    src={mealIllustrationUrl(meal.title, meal.imagePromptEn)}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-heading text-lg font-semibold text-white drop-shadow-md">
                      {meal.title}
                    </h3>
                    {meal.tagline ? (
                      <p className="mt-1 text-sm text-white/80 drop-shadow">{meal.tagline}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2 text-xs text-white/70">
                      <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1">
                        {Math.round(meal.approximateMacros.calories)} kcal
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1">
                        B {fmtMacro(meal.approximateMacros.proteinG, "g")}
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1">
                        T {fmtMacro(meal.approximateMacros.fatG, "g")}
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1">
                        W {fmtMacro(meal.approximateMacros.carbsG, "g")}
                      </span>
                    </div>
                    <AddToMealLogSheet
                      dateKey={gaps.dateKey}
                      presetName={meal.title}
                      triggerLabel="Dodaj"
                      calories={meal.approximateMacros.calories}
                      proteinG={meal.approximateMacros.proteinG}
                      fatG={meal.approximateMacros.fatG}
                      carbsG={meal.approximateMacros.carbsG}
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                      Składniki
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-white/80">
                      {meal.ingredients.map((ing) => (
                        <li key={ing}>{ing}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
                      Przepis
                    </p>
                    <ol className="mt-2 list-inside list-decimal space-y-2 text-sm text-white/80">
                      {meal.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <p className="mt-auto text-[11px] text-white/40">
                    Makro przybliżone dla jednej porcji.
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center text-sm text-white/50">
          Kliknij „Propozycje na dziś”, żeby dobrać 4 dania do makro, albo przeglądaj katalog powyżej.
        </section>
      )}
    </div>
  );
}
