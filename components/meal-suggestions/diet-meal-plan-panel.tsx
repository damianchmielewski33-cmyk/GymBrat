"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
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
import { hapticTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const PLAN_GOLD = "#DDBB6D";
const PLAN_GOLD_RGB = "221, 187, 109";

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

function mealTileTitle(row: MealPlanRow): string {
  const label = row.label.trim();
  const fallback = `Posiłek ${row.index}`;
  if (!label || label.toLowerCase() === fallback.toLowerCase()) {
    return fallback;
  }
  return `${fallback} · ${label}`;
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.72, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0E0E0E]/90 shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <ShoppingBag
          className="h-5 w-5 shrink-0 text-[#DDBB6D]"
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
                      ? "border-[#DDBB6D]/60 bg-[#DDBB6D] text-black"
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
  const macros = [
    { n: Math.round(row.proteinG), label: "Białko" },
    { n: Math.round(row.carbsG), label: "Węgle" },
    { n: Math.round(row.fatG), label: "Tłuszcze" },
  ] as const;
  const kcal = row.calories > 0 ? Math.round(row.calories) : null;

  return (
    <motion.li
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSoft, delay: 0.6 + index * 0.06 }}
      className="list-none"
    >
      <motion.div
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className={cn(
          "overflow-hidden rounded-[22px] border",
          "bg-[#0E0E0E]/92 backdrop-blur-xl",
          "shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.04)]",
          open
            ? "border-[rgba(221,187,109,0.32)] shadow-[0_0_0_1px_rgba(221,187,109,0.12),0_16px_48px_rgba(0,0,0,0.5)]"
            : "border-white/[0.08]",
        )}
      >
        <button
          type="button"
          onClick={() => {
            hapticTap();
            onToggle();
          }}
          className="flex w-full items-center gap-3 px-4 py-4 text-left"
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1 space-y-3">
            <p className="truncate text-[16px] font-semibold tracking-tight text-white">
              {mealTileTitle(row)}
            </p>
            <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
              {macros.map((m) => (
                <div key={m.label} className="min-w-0 font-metric tabular-nums">
                  <p className="text-[15px] font-semibold leading-none text-white">
                    {m.n}
                    <span className="ml-0.5 text-[11px] font-medium text-white/40">
                      g
                    </span>
                  </p>
                  <p
                    className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: PLAN_GOLD }}
                  >
                    {m.label}
                  </p>
                </div>
              ))}
              {kcal != null ? (
                <div className="ml-auto min-w-0 font-metric tabular-nums sm:ml-0">
                  <p className="text-[15px] font-semibold leading-none text-white/85">
                    {kcal}
                    <span className="ml-1 text-[11px] font-medium text-white/40">
                      kcal
                    </span>
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4",
                open ? "text-[#DDBB6D]" : "text-white/40",
              )}
            />
          </motion.span>
        </button>

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
      </motion.div>
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
  const proteinGoal = dayMacros.proteinGoal;
  const carbsGoal = dayMacros.carbsGoal;
  const fatGoal = dayMacros.fatGoal;

  return (
    <div className="space-y-5">
      {/* Hero makro */}
      <motion.section
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springSoft, delay: 0.35 }}
        className="relative overflow-hidden rounded-[26px] border border-white/[0.08] px-5 py-5 sm:px-6 sm:py-6"
        style={{
          background: `
            radial-gradient(110% 90% at 18% -15%, rgba(${PLAN_GOLD_RGB}, 0.18) 0%, transparent 55%),
            radial-gradient(70% 50% at 100% 80%, rgba(${PLAN_GOLD_RGB}, 0.05) 0%, transparent 45%),
            linear-gradient(165deg, rgba(255,255,255,0.04) 0%, transparent 40%),
            #0A0A0A
          `,
          boxShadow: `
            0 0 0 1px rgba(${PLAN_GOLD_RGB}, 0.08),
            0 0 56px rgba(${PLAN_GOLD_RGB}, 0.08),
            inset 0 1px 0 rgba(255,255,255,0.06)
          `,
        }}
      >
        <div
          aria-hidden
          className="diary-macro-sheen pointer-events-none absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-transparent via-white/18 to-transparent"
        />

        <p
          className="relative text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: PLAN_GOLD }}
        >
          Makro na dzień
        </p>

        <div className="relative mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            {kcalGoal != null ? (
              <>
                <p className="font-metric text-[clamp(2.75rem,11vw,3.75rem)] font-semibold leading-none tracking-tight text-white">
                  <AnimatedMetric
                    value={Math.round(kcalGoal)}
                    durationMs={700}
                    className="text-[clamp(2.75rem,11vw,3.75rem)] leading-none"
                  />
                </p>
                <p className="mt-2 text-[13px] font-medium uppercase tracking-[0.14em] text-white/45">
                  kcal
                </p>
              </>
            ) : (
              <>
                <p className="font-metric text-[2.75rem] font-semibold leading-none text-white/30">
                  —
                </p>
                <p className="mt-2 text-[13px] font-medium uppercase tracking-[0.14em] text-white/35">
                  kcal · ustaw cel w profilu
                </p>
              </>
            )}
          </div>

          <div className="shrink-0 space-y-3.5 text-right font-metric tabular-nums">
            {(
              [
                { value: proteinGoal, label: "białko", unit: "g" },
                { value: carbsGoal, label: "węgle", unit: "g" },
                { value: fatGoal, label: "tłuszcze", unit: "g" },
              ] as const
            ).map((row) => (
              <div key={row.label}>
                {row.value != null ? (
                  <p className="text-[18px] font-semibold leading-none text-white sm:text-[20px]">
                    <AnimatedMetric
                      value={Math.round(row.value)}
                      durationMs={700}
                      className="text-[18px] leading-none sm:text-[20px]"
                    />
                    <span className="ml-1 text-[12px] font-medium text-white/40">
                      {row.unit}
                    </span>
                  </p>
                ) : (
                  <p className="text-[18px] font-semibold leading-none text-white/30">
                    —
                  </p>
                )}
                <p
                  className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
                  style={{ color: PLAN_GOLD }}
                >
                  {row.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <section className="space-y-3">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.52 }}
        >
          <SectionLabel
            index={1}
            title="Posiłki"
            trailing={`${rows.length} na dzień`}
          />
        </motion.div>
        {mealTemplates.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-white/12 bg-[#0E0E0E] px-4 py-3 text-[13px] leading-relaxed text-white/50">
            Brak własnych posiłków w profilu — pokazujemy 5 domyślnych slotów
            z makro podzielonym z celu dnia. Ustaw B/W/T per posiłek w Profilu
            (max 5), żeby przepisy były skalowane dokładnie pod Ciebie.
          </p>
        ) : null}
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
              onShoppingChange={setShopping}
            />
          ))}
        </ul>
      </section>

      <ShoppingListCard items={shopping} onChange={setShopping} />

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
        <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0E0E0E]/90">
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
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#DDBB6D]" />
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
                  className="text-sm font-medium text-[#DDBB6D] hover:text-[#E8D08A]"
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
        <div className="space-y-4 rounded-[22px] border border-white/[0.08] bg-[#0E0E0E]/90 p-4">
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
                className="text-[40px] leading-none text-[#DDBB6D]"
              />
              <span className="mb-1.5 text-sm text-white/45">min</span>
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
        <div className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0E0E0E]/90">
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
                  <p className="text-sm font-semibold text-[#DDBB6D]">
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
