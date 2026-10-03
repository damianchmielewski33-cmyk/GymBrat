"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { DietRecipeGrid } from "@/components/meal-suggestions/diet-recipe-grid";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import type { MealTemplate } from "@/lib/meal-templates";
import type { NutritionDayType } from "@/lib/nutrition-goals";
import {
  buildMealPlanRows,
  formatMealMacroLine,
} from "@/lib/diet-recipe-match";
import {
  clearShoppingList,
  listShoppingItems,
  removeShoppingItem,
  toggleShoppingItem,
  type ShoppingListItem,
} from "@/lib/shopping-list";
import { cn } from "@/lib/utils";

const CHEATSHEET_TIPS = [
  {
    title: "Białko na każdy posiłek",
    body: "Celuj w porcję białka przy każdym posiłku — łatwiej domknąć dzienny cel B bez dużych skoków wieczorem.",
  },
  {
    title: "Węgle wokół treningu",
    body: "W dniu treningowym więcej węgli przed i po sesji; w dniu wolnym możesz zejść niżej przy tym samym białku.",
  },
  {
    title: "Tłuszcze = sytość",
    body: "Nie tnij tłuszczu do zera — pomaga w hormonach i sytości. Lepiej dołożyć oliwę, orzechy lub tłustą rybę.",
  },
  {
    title: "Przygotuj na zapas",
    body: "Jedno większe gotowanie (ryż, mięso, warzywa) skraca decyzje w ciągu tygodnia i trzyma Cię w planie.",
  },
];

function MacroChip({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit: string;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-white/[0.08] bg-black/25 px-2.5 py-2.5 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <p className="mt-1 font-metric text-[22px] tabular-nums text-white">
        {value != null ? Math.round(value) : "—"}
        <span className="ml-0.5 text-[11px] text-white/40">{unit}</span>
      </p>
    </div>
  );
}

function ShoppingListCard({
  items,
  onChange,
}: {
  items: ShoppingListItem[];
  onChange: (next: ShoppingListItem[]) => void;
}) {
  return (
    <div className="app-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
          <p className="text-sm font-semibold text-white">Lista zakupów</p>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange(clearShoppingList())}
            className="text-[11px] font-medium text-white/40 hover:text-white/70"
          >
            Wyczyść
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-white/40">
          Stuknij ikonę torby przy przepisie — składniki wpadną na listę.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-2.5 py-2"
            >
              <button
                type="button"
                aria-label={item.checked ? "Odznacz" : "Zaznacz"}
                onClick={() => onChange(toggleShoppingItem(item.id))}
                className={cn(
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                  item.checked
                    ? "border-[var(--gym-gold)]/60 bg-[var(--gym-gold)] text-black"
                    : "border-white/25 text-transparent",
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm text-white/90",
                    item.checked && "text-white/40 line-through",
                  )}
                >
                  {item.name}
                </p>
                {item.recipeTitle ? (
                  <p className="mt-0.5 truncate text-[11px] text-white/35">
                    {item.recipeTitle}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Usuń z listy"
                onClick={() => onChange(removeShoppingItem(item.id))}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.06] hover:text-rose-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DietMealPlanPanel({
  mealTemplates,
  catalogMeals,
  dateKey,
  dayKind,
  dayMacros,
  supplementNames,
  weeklyCardioGoalMinutes,
}: {
  mealTemplates: MealTemplate[];
  catalogMeals: CatalogMeal[];
  dateKey: string;
  dayKind: NutritionDayType;
  dayMacros: {
    proteinGoal: number | null;
    carbsGoal: number | null;
    fatGoal: number | null;
    caloriesGoal: number | null;
  };
  supplementNames: string[];
  weeklyCardioGoalMinutes: number;
}) {
  const rows = useMemo(
    () => buildMealPlanRows(mealTemplates, dayMacros),
    [mealTemplates, dayMacros],
  );
  const [openId, setOpenId] = useState<string | null>(rows[0]?.id ?? null);
  const [shopping, setShopping] = useState<ShoppingListItem[]>([]);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [suppOpen, setSuppOpen] = useState(false);

  useEffect(() => {
    setShopping(listShoppingItems());
  }, []);

  useEffect(() => {
    if (!rows.some((r) => r.id === openId)) {
      setOpenId(rows[0]?.id ?? null);
    }
  }, [rows, openId]);

  const kcalGoal = dayMacros.caloriesGoal;
  const dayLabel =
    dayKind === "training" ? "Dzień treningowy" : "Dzień nietreningowy";

  return (
    <div className="space-y-5">
      <header className="space-y-3 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          {dayLabel}
        </p>
        <div className="flex items-end gap-2">
          {kcalGoal != null ? (
            <AnimatedMetric
              value={Math.round(kcalGoal)}
              className="text-[52px] leading-none text-white"
            />
          ) : (
            <span className="font-metric text-[52px] leading-none text-white/35">
              —
            </span>
          )}
          <span className="mb-2 text-sm font-medium text-white/45">kcal</span>
        </div>
        <div className="flex gap-2">
          <MacroChip label="Białko" value={dayMacros.proteinGoal} unit="g" />
          <MacroChip label="Węgle" value={dayMacros.carbsGoal} unit="g" />
          <MacroChip label="Tłuszcz" value={dayMacros.fatGoal} unit="g" />
        </div>
      </header>

      <section className="space-y-3">
        <SectionLabel index={1} title="Posiłki" trailing={`${rows.length}`} />
        <div className="app-card overflow-hidden">
          <ul className="divide-y divide-white/[0.06]">
            {rows.map((row) => {
              const open = openId === row.id;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : row.id)}
                    className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left"
                    aria-expanded={open}
                  >
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        open
                          ? "bg-[var(--gym-gold)] text-black"
                          : "border border-white/15 text-white/55",
                      )}
                    >
                      {row.index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-white">
                        {row.label}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-white/45">
                        {formatMealMacroLine(row)}
                        {row.calories > 0
                          ? ` · ${Math.round(row.calories)} kcal`
                          : ""}
                      </p>
                    </div>
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
                    )}
                  </button>
                  {open ? (
                    <div className="border-t border-white/[0.04] px-3 pb-4 pt-1">
                      <DietRecipeGrid
                        key={row.id}
                        meals={catalogMeals}
                        row={row}
                        dateKey={dateKey}
                        onShoppingChange={setShopping}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <ShoppingListCard items={shopping} onChange={setShopping} />

      <section className="space-y-3">
        <SectionLabel
          index={2}
          title="Suplementy"
          trailing={`${supplementNames.length}`}
        />
        <div className="app-card overflow-hidden">
          <button
            type="button"
            onClick={() => setSuppOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left"
            aria-expanded={suppOpen}
          >
            <p className="text-sm text-white/80">
              {supplementNames.slice(0, 3).join(", ")}
              {supplementNames.length > 3
                ? ` +${supplementNames.length - 3}`
                : ""}
            </p>
            {suppOpen ? (
              <ChevronDown className="h-4 w-4 text-white/40" />
            ) : (
              <ChevronRight className="h-4 w-4 text-white/35" />
            )}
          </button>
          {suppOpen ? (
            <ul className="divide-y divide-white/[0.05] border-t border-white/[0.06]">
              {supplementNames.map((name) => (
                <li
                  key={name}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-white/85"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gym-gold)]" />
                  {name}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel index={3} title="Zalecenia" />
        <div className="app-card space-y-4 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Nawodnienie
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/75">
              Celuj w ok. 30–35 ml wody na kg masy ciała. Pij regularnie w ciągu
              dnia — nie tylko przy treningu.
            </p>
          </div>
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Cardio w tygodniu
            </p>
            <div className="mt-2 flex items-end gap-2">
              <AnimatedMetric
                value={weeklyCardioGoalMinutes}
                className="text-[40px] leading-none text-[var(--gym-gold)]"
              />
              <span className="mb-1.5 text-sm text-white/45">min</span>
            </div>
            <p className="mt-1 text-sm text-white/55">
              Tygodniowy cel cardio z Twoich ustawień.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel index={4} title="Ściąga" />
        <div className="app-card overflow-hidden">
          <button
            type="button"
            onClick={() => setTipsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left"
            aria-expanded={tipsOpen}
          >
            <div>
              <p className="text-sm font-semibold text-white">
                Szybkie wskazówki żywieniowe
              </p>
              <p className="mt-0.5 text-xs text-white/45">
                Rozwiń, żeby zobaczyć ściągę
              </p>
            </div>
            {tipsOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
            )}
          </button>
          {tipsOpen ? (
            <ul className="space-y-3 border-t border-white/[0.06] px-4 py-4">
              {CHEATSHEET_TIPS.map((tip) => (
                <li key={tip.title}>
                  <p className="text-sm font-semibold text-[var(--gym-gold)]">
                    {tip.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    {tip.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
