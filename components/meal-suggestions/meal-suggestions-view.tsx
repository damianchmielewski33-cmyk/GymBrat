"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FitatuDaySummary } from "@/types/fitatu";
import type { MacroGaps } from "@/lib/meal-suggestions-gaps";
import type { MealLogDto } from "@/lib/meal-logs";
import {
  dietDiarySlotFromHour,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import { FoodSearchScan } from "@/components/meal-suggestions/food-search-scan";
import { DietDiarySections } from "@/components/meal-suggestions/diet-diary-sections";
import { MealCatalogBrowser } from "@/components/meal-suggestions/meal-catalog-browser";
import { InlineBanner } from "@/components/ui/inline-banner";
import { ChefHat } from "lucide-react";
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

export function MealSuggestionsView({
  initialSummary,
  initialGaps,
  initialLogs,
  mealTemplates = [],
}: {
  initialSummary: FitatuDaySummary;
  initialGaps: MacroGaps;
  initialLogs: MealLogDto[];
  mealTemplates?: MealTemplate[];
}) {
  const router = useRouter();
  const [gaps] = useState(initialGaps);
  const [defaultSlot, setDefaultSlot] = useState<DietDiarySlot>("sniadanie");
  const [, start] = useTransition();

  useEffect(() => {
    setDefaultSlot(dietDiarySlotFromHour(new Date().getHours()));
  }, []);

  return (
    <div className="space-y-3">
      <header className="px-0.5 pb-1 pt-2">
        <p className="app-label">Dieta</p>
        <h1 className="mt-2 text-[32px] font-semibold leading-tight text-white">
          Twój plan żywieniowy
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Szukaj i skanuj produkty z bazy — zobacz makro (B/W/T) i dodaj je do sekcji posiłków na dole
          ekranu, jak w Fitatu.
        </p>
      </header>

      <section className="app-card p-5">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ChefHat className="h-5 w-5 text-[var(--neon)]" aria-hidden />
            <h2 className="text-lg font-semibold text-white">Dziś</h2>
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

          {!gaps.hasAnyMacroGoal ? (
            <p className="text-sm text-white/55">
              Uzupełnij cele kaloryczne i makro w{" "}
              <a href="/profile" className="text-[var(--neon)] underline-offset-4 hover:underline">
                profilu
              </a>
              , żeby widzieć braki dnia.
            </p>
          ) : null}

          {mealTemplates.length > 0 ? (
            <div className="border-t border-white/[0.05] pt-4">
              <p className="app-label">Szablony z profilu</p>
              <div className="mt-2 divide-y divide-white/[0.05]">
                {mealTemplates.map((meal, i) => (
                  <div key={meal.id} className="flex items-center justify-between gap-3 py-2.5">
                    <p className="truncate text-sm text-white/85">
                      {i + 1}. {meal.name}
                    </p>
                    <p className="shrink-0 text-xs tabular-nums text-[var(--neon)]">
                      {Math.round(meal.proteinG)}B · {Math.round(meal.carbsG)}W ·{" "}
                      {Math.round(meal.fatG)}T
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <FoodSearchScan
        dateKey={gaps.dateKey}
        defaultSlot={defaultSlot}
        onAdded={() => {
          start(() => {
            router.refresh();
          });
        }}
      />

      <MealCatalogBrowser dateKey={gaps.dateKey} />

      <DietDiarySections
        dateKey={gaps.dateKey}
        entries={initialLogs}
        defaultSlot={defaultSlot}
      />
    </div>
  );
}
