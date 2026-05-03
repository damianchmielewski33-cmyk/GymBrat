"use client";

import { useState, useTransition } from "react";
import type { FitatuDaySummary } from "@/types/fitatu";
import type { MacroGaps } from "@/lib/meal-suggestions-gaps";
import { mealIllustrationUrl } from "@/lib/meal-suggestions-gaps";
import type { MealSuggestionItem } from "@/lib/meal-suggestions-schema";
import { generateMealSuggestionsAction } from "@/actions/meal-suggestions";
import { Button } from "@/components/ui/button";
import { ChefHat, Loader2, Sparkles } from "lucide-react";

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
  modelAllowed,
}: {
  initialSummary: FitatuDaySummary;
  initialGaps: MacroGaps;
  /** Dostawca AI skonfigurowany i użytkownik nie wyłączył AI w profilu */
  modelAllowed: boolean;
}) {
  const [gaps, setGaps] = useState(initialGaps);
  const [meals, setMeals] = useState<MealSuggestionItem[] | null>(null);
  const [source, setSource] = useState<"ai" | "static" | "user_disabled" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function generate() {
    setError(null);
    start(async () => {
      const r = await generateMealSuggestionsAction();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMeals(r.meals);
      setSource(r.source);
      setGaps(r.gaps);
    });
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">Odżywianie</p>
        <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">Propozycje posiłków</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Na podstawie Twojego dziennego bilansu (spożycie vs cele) wygenerujemy propozycje posiłków z
          przepisami. Ilustracje są poglądowe (zewnętrzny generator obrazu z opisu dania).
        </p>
      </header>

      <section className="glass-panel relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(720px_280px_at_10%_0%,rgba(255,45,85,0.12),transparent_58%)]" />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-[var(--neon)]" aria-hidden />
              <h2 className="font-heading text-lg font-semibold text-white">Dziś ({gaps.dateKey})</h2>
            </div>
            <Button
              type="button"
              disabled={pending}
              onClick={() => generate()}
              className="bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
            >
              {pending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Generuję…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                  Wygeneruj propozycje
                </>
              )}
            </Button>
          </div>

          {initialSummary.source === "error" ? (
            <p className="text-sm text-amber-200/90">
              {initialSummary.errorMessage ?? "Nie udało się pobrać danych odżywczych."}
            </p>
          ) : (
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
          )}

          {!gaps.hasAnyMacroGoal ? (
            <p className="text-sm text-white/55">
              Uzupełnij cele kaloryczne i makro w{" "}
              <a href="/profile" className="text-[var(--neon)] underline-offset-4 hover:underline">
                profilu
              </a>
              , aby precyzyjniej domykać braki — model i tak zaproponuje zbilansowane posiłki.
            </p>
          ) : null}

          {!modelAllowed ? (
            <p className="text-sm text-white/55">
              Funkcje AI są wyłączone lub dostawca nie jest skonfigurowany — po kliknięciu zobaczysz
              statyczne przykładowe przepisy. Włącz AI w profilu i ustaw zmienne środowiskowe, aby
              generować spersonalizowane propozycje.
            </p>
          ) : null}

          {error ? <p className="text-sm text-amber-200">{error}</p> : null}

          {source === "user_disabled" ? (
            <p className="text-sm text-white/60">
              Masz wyłączone funkcje AI w profilu — pokazujemy zestaw przykładowy. Włącz AI, aby
              otrzymywać propozycje dopasowane do Twoich braków.
            </p>
          ) : null}
        </div>
      </section>

      {meals && meals.length > 0 ? (
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
                  Makro przybliżone dla jednej porcji. Ilustracja: syntetyczna wizualizacja na podstawie
                  nazwy dania — nie jest zdjęciem realnego przygotowanego posiłku.
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center text-sm text-white/50">
          Kliknij „Wygeneruj propozycje”, aby zobaczyć przepisy i ilustracje.
        </section>
      )}
    </div>
  );
}
