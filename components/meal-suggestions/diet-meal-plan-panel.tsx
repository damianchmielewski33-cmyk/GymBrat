"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { DietRecipeGrid } from "@/components/meal-suggestions/diet-recipe-grid";
import { RecipeImage } from "@/components/meal-suggestions/recipe-image";
import { addMealProductAction } from "@/actions/meal-log";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { DIET_DIARY_SLOT_LABELS } from "@/lib/diet-diary-slots";
import { MacroProgressHero } from "@/components/meal-suggestions/macro-progress-hero";
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
  filterCatalogForMealPlan,
  type MealPlanRow,
} from "@/lib/diet-recipe-match";
import {
  clearShoppingList,
  getShoppingListSnapshot,
  parseShoppingList,
  subscribeShoppingList,
  removeShoppingItem,
  toggleShoppingItem,
  type ShoppingListItem,
} from "@/lib/shopping-list";
import { hapticTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const springSoft = { type: "spring" as const, stiffness: 380, damping: 28 };
const springExpand = { type: "spring" as const, stiffness: 320, damping: 30 };

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

/** Lista zakupów jest odczytywana ze store (localStorage) — callbacki zmian są zbędne. */
function ignoreShoppingChange() {}

function ShoppingListCard({
  items,
  onChange,
}: {
  items: ShoppingListItem[];
  onChange: (next: ShoppingListItem[]) => void;
}) {
  const [open, setOpen] = useState(items.length > 0);
  const [prevCount, setPrevCount] = useState(items.length);

  // Rozwiń kartę, gdy lista się zmieni i nie jest pusta (bez efektu — patrz
  // „adjusting state while rendering” w dokumentacji React).
  if (prevCount !== items.length) {
    setPrevCount(items.length);
    if (items.length > 0) setOpen(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.72, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0E0E]/90 shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
    >
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
            <p className="mt-0.5 text-[12px] leading-snug text-white/50">
              pusta — dodaj danie ikonką torby na kafelku
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] text-white/50">
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
          <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
        )}
      </button>

      {open && items.length > 0 ? (
        <div className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onChange(clearShoppingList())}
              className="text-[11px] font-medium text-white/50 hover:text-white/70"
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
                      item.checked && "text-white/50 line-through",
                    )}
                  >
                    {item.name}
                  </p>
                  {item.recipeTitle ? (
                    <p className="mt-0.5 truncate text-[11px] text-white/50">
                      {item.recipeTitle}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Usuń z listy"
                  onClick={() => onChange(removeShoppingItem(item.id))}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/50 hover:bg-white/[0.06] hover:text-state-error"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </motion.div>
  );
}

function PlanMealCard({
  row,
  index,
  open,
  catalogMeals,
  dateKey,
  onToggle,
  onShoppingChange,
}: {
  row: MealPlanRow;
  index: number;
  open: boolean;
  catalogMeals: CatalogMeal[];
  dateKey: string;
  onToggle: () => void;
  onShoppingChange: (next: ShoppingListItem[]) => void;
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [adding, startAdd] = useTransition();
  const slotLabel = DIET_DIARY_SLOT_LABELS[row.diarySlot];
  const suggestion = useMemo(
    () =>
      filterCatalogForMealPlan({
        meals: catalogMeals,
        row,
        query: "",
        difficulty: "all",
        taste: "all",
        limit: 1,
      })[0] ?? null,
    [catalogMeals, row],
  );
  const macros = suggestion?.scaledMacros ?? null;
  const kcal = macros
    ? Math.round(macros.calories)
    : row.calories > 0
      ? Math.round(row.calories)
      : null;

  const addSuggestion = () => {
    if (!suggestion || !macros) return;
    hapticTap();
    startAdd(async () => {
      const r = await addMealProductAction({
        date: dateKey,
        slot: row.diarySlot,
        name: suggestion.meal.title,
        proteinG: macros.proteinG,
        fatG: macros.fatG,
        carbsG: macros.carbsG,
        calories: macros.calories,
      });
      if (!r.ok) {
        notifyError(r.error ?? "Nie udało się dodać posiłku.");
        return;
      }
      notifySaved(`Dodano „${suggestion.meal.title}” do dziennika.`);
      router.refresh();
    });
  };

  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: Math.min(index, 5) * 0.05 }}
      className="list-none"
    >
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-gradient-to-b from-white/[0.05] to-white/[0.015]",
          open ? "border-[rgba(221,187,109,0.32)]" : "border-white/[0.08]",
        )}
      >
        <div className="flex items-center gap-2 p-2.5">
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onToggle();
            }}
            className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 text-left"
            aria-expanded={open}
            aria-label={`${slotLabel}: pokaż inne przepisy`}
          >
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-black/40">
              {suggestion ? (
                <RecipeImage recipe={suggestion.meal} alt="" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--gym-gold)]">
                {slotLabel}
              </span>
              <span className="mt-0.5 block truncate text-[14px] font-semibold text-white">
                {suggestion?.meal.title ?? `Posiłek ${row.index}`}
              </span>
              <span className="mt-0.5 block text-[12px] tabular-nums text-white/60">
                {kcal != null ? `${kcal} kcal` : ""}
                {macros
                  ? ` · B ${Math.round(macros.proteinG)} · W ${Math.round(macros.carbsG)} · T ${Math.round(macros.fatG)}`
                  : ""}
              </span>
            </span>
          </button>
          {suggestion ? (
            <button
              type="button"
              disabled={adding}
              onClick={addSuggestion}
              aria-label={`Dodaj do dziennika: ${suggestion.meal.title}`}
              className="gold-btn inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-black disabled:opacity-55"
            >
              <Plus className="h-5 w-5" strokeWidth={2.75} />
            </button>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={springExpand}
              className="overflow-hidden"
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="border-t border-white/[0.06] px-3 pb-4 pt-2"
              >
                <DietRecipeGrid
                  key={row.id}
                  meals={catalogMeals}
                  row={row}
                  dateKey={dateKey}
                  onShoppingChange={onShoppingChange}
                />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.li>
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
    caloriesConsumed: number;
    caloriesGoal: number | null;
    proteinConsumed: number;
    proteinGoal: number | null;
    carbsConsumed: number;
    carbsGoal: number | null;
    fatConsumed: number;
    fatGoal: number | null;
  };
  supplements: DietSupplement[];
  weeklyCardioGoalMinutes: number;
}) {
  void _dayKind;
  void mealTemplates;
  // Tura 2: zawsze równy podział celu dnia (bez szablonów z profilu).
  const rows = useMemo(
    () =>
      buildMealPlanRows([], {
        proteinGoal: dayMacros.proteinGoal,
        carbsGoal: dayMacros.carbsGoal,
        fatGoal: dayMacros.fatGoal,
        caloriesGoal: dayMacros.caloriesGoal,
      }),
    [dayMacros],
  );
  const [openIdState, setOpenId] = useState<string | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [suppOpen, setSuppOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<"mine" | "catalog">("catalog");

  const openId =
    openIdState && rows.some((r) => r.id === openIdState) ? openIdState : null;

  const shoppingRaw = useSyncExternalStore(
    subscribeShoppingList,
    getShoppingListSnapshot,
    () => "",
  );
  const shopping = useMemo(() => parseShoppingList(shoppingRaw), [shoppingRaw]);

  return (
    <div className="space-y-5">
      <MacroProgressHero
        label="Dziś zostało"
        mode="remaining"
        enterDelay={0.35}
        calories={{
          consumed: dayMacros.caloriesConsumed,
          goal: dayMacros.caloriesGoal,
        }}
        protein={{
          consumed: dayMacros.proteinConsumed,
          goal: dayMacros.proteinGoal,
        }}
        carbs={{
          consumed: dayMacros.carbsConsumed,
          goal: dayMacros.carbsGoal,
        }}
        fat={{
          consumed: dayMacros.fatConsumed,
          goal: dayMacros.fatGoal,
        }}
      />

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-white/[0.1] bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setLibraryTab("mine")}
            className={cn(
              "rounded-full px-3 py-2 text-[12px] font-semibold transition-colors",
              libraryTab === "mine"
                ? "bg-gradient-to-b from-[#F5E4A3] via-[#E4C56D] to-[#D1A84A] text-[var(--gym-on-gold)]"
                : "text-white/55 hover:text-white/80",
            )}
          >
            Twoje przepisy
          </button>
          <button
            type="button"
            onClick={() => setLibraryTab("catalog")}
            className={cn(
              "rounded-full px-3 py-2 text-[12px] font-semibold transition-colors",
              libraryTab === "catalog"
                ? "bg-gradient-to-b from-[#F5E4A3] via-[#E4C56D] to-[#D1A84A] text-[var(--gym-on-gold)]"
                : "text-white/55 hover:text-white/80",
            )}
          >
            Katalog
          </button>
        </div>

        {libraryTab === "mine" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <SectionLabel
                index={1}
                title="Twoje przepisy"
                className="min-w-0 flex-1"
              />
              <button
                type="button"
                disabled
                title="Własne przepisy — wkrótce"
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] px-3 text-[12px] font-semibold text-[var(--gym-gold)] opacity-70"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Dodaj przepis
              </button>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/[0.14] bg-white/[0.02] p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-white">
                  Brak własnych przepisów
                </p>
                <p className="mt-0.5 text-[12px] text-white/50">
                  Zacznij od gotowych z katalogu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setLibraryTab("catalog");
                }}
                className="gold-btn inline-flex h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-bold text-black"
              >
                Katalog
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between px-0.5">
              <h2 className="text-[17px] font-semibold text-white">
                Na dziś · {rows.length} posiłków
              </h2>
              <span className="text-[12px] text-white/55">
                {rows[0] ? `po ${Math.round(rows[0].calories)} kcal` : ""}
              </span>
            </div>
            <ul className="space-y-2.5">
              {rows.map((row, index) => (
                <PlanMealCard
                  key={row.id}
                  row={row}
                  index={index}
                  open={openId === row.id}
                  catalogMeals={catalogMeals}
                  dateKey={dateKey}
                  onToggle={() => setOpenId(openId === row.id ? null : row.id)}
                  onShoppingChange={ignoreShoppingChange}
                />
              ))}
            </ul>
          </div>
        )}
      </section>

      <ShoppingListCard items={shopping} onChange={ignoreShoppingChange} />

      <motion.section
        className="space-y-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.78 }}
      >
        <SectionLabel
          index={2}
          title="Suplementy"
          trailing={`${supplements.length}`}
        />
        <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0E0E]/90">
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
              <ChevronDown className="h-4 w-4 text-white/50" />
            ) : (
              <ChevronRight className="h-4 w-4 text-white/50" />
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
                        <span className="mt-0.5 block text-[12px] text-white/50">
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
                  className="text-sm font-medium text-[var(--gym-gold)] hover:text-[#E8D08A]"
                >
                  Zarządzaj suplementami
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </motion.section>

      <motion.section
        className="space-y-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.84 }}
      >
        <SectionLabel index={3} title="Zalecenia" />
        <div className="space-y-4 rounded-3xl border border-white/[0.08] bg-[#0E0E0E]/90 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              Nawodnienie
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/75">
              Celuj w ok. 30–35 ml wody na kg masy ciała. Pij regularnie w ciągu
              dnia — nie tylko przy treningu.
            </p>
          </div>
          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">
              Cardio w tygodniu
            </p>
            <div className="mt-2 flex items-end gap-2">
              <AnimatedMetric
                value={weeklyCardioGoalMinutes}
                className="text-[40px] leading-none text-[var(--gym-gold)]"
              />
              <span className="mb-1.5 text-sm text-white/50">min</span>
            </div>
            <p className="mt-1 text-sm text-white/55">
              Tygodniowy cel cardio z Twoich ustawień.
            </p>
          </div>
        </div>
      </motion.section>

      <motion.section
        className="space-y-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.9 }}
      >
        <SectionLabel index={4} title="Ściąga" />
        <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E0E0E]/90">
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
              <p className="mt-0.5 text-xs text-white/50">
                Rozwiń, żeby zobaczyć ściągę
              </p>
            </div>
            {tipsOpen ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-white/50" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
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
      </motion.section>
    </div>
  );
}
