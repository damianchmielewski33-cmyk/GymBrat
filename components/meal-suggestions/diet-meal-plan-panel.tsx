"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import {
  formatSupplementLine,
  type DietSupplement,
} from "@/lib/diet-supplements";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import type { MealTemplate } from "@/lib/meal-templates";
import type { NutritionDayType } from "@/lib/nutrition-goals";
import {
  buildMealPlanRows,
  type MealPlanRow,
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

function MealMacroLine({
  row,
  calories,
  className,
}: {
  row: Pick<MealPlanRow, "proteinG" | "carbsG" | "fatG">;
  calories?: number;
  className?: string;
}) {
  const parts = [
    { n: Math.round(row.proteinG), u: "B" },
    { n: Math.round(row.carbsG), u: "W" },
    { n: Math.round(row.fatG), u: "T" },
  ];
  return (
    <p
      className={cn(
        "font-metric text-[13px] tabular-nums leading-none tracking-wide",
        className,
      )}
    >
      {parts.map((p, i) => (
        <span key={p.u}>
          {i > 0 ? <span className="text-white/35"> · </span> : null}
          <span className="text-white">{p.n}</span>
          <span className="text-[var(--gym-gold)]">{p.u}</span>
        </span>
      ))}
      {calories != null && calories > 0 ? (
        <>
          <span className="text-white/35"> · </span>
          <span className="text-white">{Math.round(calories)} kcal</span>
        </>
      ) : null}
    </p>
  );
}

function ShoppingListCard({
  items,
  onChange,
}: {
  items: ShoppingListItem[];
  onChange: (next: ShoppingListItem[]) => void;
}) {
  const [open, setOpen] = useState(items.length > 0);

  useEffect(() => {
    if (items.length > 0) setOpen(true);
  }, [items.length]);

  return (
    <div className="app-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <ShoppingBag
          className="h-5 w-5 shrink-0 text-[var(--gym-gold)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-white">Lista zakupów</p>
          {items.length === 0 ? (
            <p className="mt-0.5 text-[12px] leading-snug text-white/40">
              pusta — dodaj danie ikonką torby na kafelku
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] text-white/40">
              {items.length}{" "}
              {items.length === 1
                ? "pozycja"
                : items.length < 5
                  ? "pozycje"
                  : "pozycji"}
            </p>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
        )}
      </button>

      {open && items.length > 0 ? (
        <div className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onChange(clearShoppingList())}
              className="text-[11px] font-medium text-white/40 hover:text-white/70"
            >
              Wyczyść
            </button>
          </div>
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
        </div>
      ) : null}
    </div>
  );
}

export function DietMealPlanPanel({
  mealTemplates,
  catalogMeals,
  dateKey,
  dayKind: _dayKind,
  dayMacros,
  supplements,
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
  supplements: DietSupplement[];
  weeklyCardioGoalMinutes: number;
}) {
  void _dayKind;
  const rows = useMemo(
    () => buildMealPlanRows(mealTemplates, dayMacros),
    [mealTemplates, dayMacros],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [shopping, setShopping] = useState<ShoppingListItem[]>([]);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [suppOpen, setSuppOpen] = useState(false);

  useEffect(() => {
    setShopping(listShoppingItems());
  }, []);

  useEffect(() => {
    if (openId && !rows.some((r) => r.id === openId)) {
      setOpenId(null);
    }
  }, [rows, openId]);

  const kcalGoal = dayMacros.caloriesGoal;

  return (
    <div className="space-y-5">
      <section className="app-card relative overflow-hidden px-4 py-4">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gym-gold)]/55 to-transparent"
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          Makro na dzień
        </p>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div className="flex min-w-0 items-end gap-2">
            {kcalGoal != null ? (
              <AnimatedMetric
                value={Math.round(kcalGoal)}
                className="text-[44px] leading-none text-white sm:text-[48px]"
              />
            ) : (
              <span className="font-metric text-[44px] leading-none text-white/35">
                —
              </span>
            )}
            <span className="mb-1.5 font-metric text-[18px] text-white/55">
              kcal
            </span>
          </div>
          <div className="shrink-0 space-y-1 text-right font-metric text-[15px] leading-snug tabular-nums text-white">
            <p>
              {dayMacros.proteinGoal != null
                ? Math.round(dayMacros.proteinGoal)
                : "—"}{" "}
              g{" "}
              <span className="text-[12px] text-white/45">białko</span>
            </p>
            <p>
              {dayMacros.carbsGoal != null
                ? Math.round(dayMacros.carbsGoal)
                : "—"}{" "}
              g <span className="text-[12px] text-white/45">węgle</span>
            </p>
            <p>
              {dayMacros.fatGoal != null
                ? Math.round(dayMacros.fatGoal)
                : "—"}{" "}
              g <span className="text-[12px] text-white/45">tłuszcz</span>
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionLabel
          index={1}
          title="Posiłki"
          trailing={`${rows.length} na dzień`}
        />
        {mealTemplates.length === 0 ? (
          <p className="rounded-[18px] border border-dashed border-white/12 bg-[#141414] px-4 py-3 text-[13px] leading-relaxed text-white/50">
            Brak własnych posiłków w profilu — pokazujemy 5 domyślnych slotów
            z makro podzielonym z celu dnia. Ustaw B/W/T per posiłek w Profilu
            (max 5), żeby przepisy były skalowane dokładnie pod Ciebie.
          </p>
        ) : null}
        <ul className="space-y-2.5">
          {rows.map((row) => {
            const open = openId === row.id;
            return (
              <li
                key={row.id}
                className={cn(
                  "overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#141414]",
                  open && "border-[var(--gym-gold)]/25",
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : row.id)}
                  className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left"
                  aria-expanded={open}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-white">
                      Posiłek {row.index} · {row.label}
                    </p>
                    <div className="mt-1.5">
                      <MealMacroLine row={row} calories={row.calories} />
                    </div>
                  </div>
                  {open ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 rotate-[-90deg] text-white/35" />
                  )}
                </button>
                {open ? (
                  <div className="border-t border-white/[0.05] px-3 pb-4 pt-1">
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
      </section>

      <ShoppingListCard items={shopping} onChange={setShopping} />

      <section className="space-y-3">
        <SectionLabel
          index={2}
          title="Suplementy"
          trailing={`${supplements.length}`}
        />
        <div className="app-card overflow-hidden">
          <button
            type="button"
            onClick={() => setSuppOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left"
            aria-expanded={suppOpen}
          >
            <p className="text-sm text-white/80">
              {supplements
                .slice(0, 3)
                .map(formatSupplementLine)
                .join(", ") || "Brak suplementów"}
              {supplements.length > 3
                ? ` +${supplements.length - 3}`
                : ""}
            </p>
            {suppOpen ? (
              <ChevronDown className="h-4 w-4 text-white/40" />
            ) : (
              <ChevronRight className="h-4 w-4 text-white/35" />
            )}
          </button>
          {suppOpen ? (
            <div className="border-t border-white/[0.06]">
              <ul className="divide-y divide-white/[0.05]">
                {supplements.map((item) => (
                  <li
                    key={`${item.name}-${item.amount ?? ""}`}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-white/85"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gym-gold)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block">{item.name}</span>
                      {item.amount?.trim() ? (
                        <span className="mt-0.5 block text-[12px] text-white/45">
                          {item.amount.trim()}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-white/[0.06] px-4 py-3">
                <Link
                  href="/supplements"
                  className="text-sm font-medium text-[var(--gym-gold)] hover:text-[var(--gym-gold-bright)]"
                >
                  Zarządzaj suplementami
                </Link>
              </div>
            </div>
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
