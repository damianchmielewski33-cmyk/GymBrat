"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import type { FoodAmountUnit, FoodProduct } from "@/lib/food-products-types";
import {
  defaultPortionForProduct,
  scaleFoodMacros,
  type FoodPortionMacros,
} from "@/lib/food-portion";
import {
  DIET_DIARY_SLOT_LABELS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import {
  buildMealPlanRows,
  MEAL_PLAN_DIARY_SLOTS,
  type MealPlanRow,
} from "@/lib/diet-recipe-match";
import type { MealTemplate } from "@/lib/meal-templates";
import { cn } from "@/lib/utils";

function fmt1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return String(r).replace(".", ",");
}

function fmt0(n: number): string {
  return String(Math.round(n));
}

const GRAM_CHIPS = [50, 100, 150, 200] as const;

type SlotEaten = {
  proteinG: number;
  carbsG: number;
  fatG: number;
  calories: number;
};

function SlotImpactCard({
  row,
  eaten,
  adding,
}: {
  row: MealPlanRow;
  eaten: SlotEaten;
  adding: FoodPortionMacros;
}) {
  const left = {
    proteinG: Math.max(0, row.proteinG - eaten.proteinG),
    carbsG: Math.max(0, row.carbsG - eaten.carbsG),
    fatG: Math.max(0, row.fatG - eaten.fatG),
    calories: Math.max(0, row.calories - eaten.calories),
  };
  const after = {
    proteinG: Math.max(0, left.proteinG - adding.proteinG),
    carbsG: Math.max(0, left.carbsG - adding.carbsG),
    fatG: Math.max(0, left.fatG - adding.fatG),
    calories: Math.max(0, left.calories - adding.calories),
  };

  let closeHint: string | null = null;
  if (adding.proteinG > 0 && left.proteinG > 0 && adding.effectiveGrams != null) {
    const gramsPerProtein = adding.effectiveGrams / adding.proteinG;
    const needG = Math.ceil(left.proteinG * gramsPerProtein);
    if (needG > 0 && Number.isFinite(needG)) {
      closeHint = `${needG} g domyka białko`;
    }
  }

  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-[#161616] px-4 py-3.5">
      <p className="text-[12px] leading-snug text-white/55">
        <span className="text-white/40">W posiłku zostało:</span>{" "}
        <span className="tabular-nums text-white/80">
          B {fmt0(left.proteinG)} g · W {fmt0(left.carbsG)} g · T {fmt0(left.fatG)}{" "}
          g · {fmt0(left.calories)} kcal
        </span>
      </p>
      <p className="mt-1.5 text-[12px] leading-snug text-white/55">
        <span className="text-white/40">Po dodaniu:</span>{" "}
        <span className="tabular-nums text-white/80">
          B {fmt0(after.proteinG)} g · W {fmt0(after.carbsG)} g · T{" "}
          {fmt0(after.fatG)} g · {fmt0(after.calories)} kcal
        </span>
      </p>
      {closeHint ? (
        <p className="mt-2.5 inline-flex rounded-full border border-white/12 bg-black/35 px-2.5 py-1 text-[11px] font-medium text-white/70">
          {closeHint}
        </p>
      ) : null}
    </div>
  );
}

export function FoodPortionScreen({
  product,
  open,
  onClose,
  slot,
  onSlotChange,
  pending,
  mealTemplates = [],
  dayMacros,
  slotEaten,
  onConfirm,
}: {
  product: FoodProduct | null;
  open: boolean;
  onClose: () => void;
  slot: DietDiarySlot;
  onSlotChange?: (slot: DietDiarySlot) => void;
  pending?: boolean;
  mealTemplates?: MealTemplate[];
  dayMacros: {
    caloriesConsumed: number;
    caloriesGoal: number | null;
    proteinConsumed: number;
    proteinGoal: number | null;
    fatConsumed: number;
    fatGoal: number | null;
    carbsConsumed: number;
    carbsGoal: number | null;
  };
  /** Już zjedzone w wybranym slocie (suma logów). */
  slotEaten?: SlotEaten;
  onConfirm: (args: {
    product: FoodProduct;
    amount: number;
    unit: FoodAmountUnit;
    macros: FoodPortionMacros;
  }) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [amountStr, setAmountStr] = useState("150");
  const [unit, setUnit] = useState<FoodAmountUnit>("g");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!product || !open) return;
    const d = defaultPortionForProduct(product);
    setAmountStr(String(d.amount));
    setUnit(d.unit);
  }, [product, open]);

  const amount = Number(String(amountStr).replace(",", "."));
  const macros = useMemo(() => {
    if (!product || !Number.isFinite(amount) || amount <= 0) return null;
    return scaleFoodMacros(product, amount, unit);
  }, [product, amount, unit]);

  const per100 = useMemo(() => {
    if (!product) return null;
    return scaleFoodMacros(product, 100, "g");
  }, [product]);

  const mealRows = useMemo(
    () =>
      buildMealPlanRows(mealTemplates, {
        proteinGoal: dayMacros.proteinGoal,
        carbsGoal: dayMacros.carbsGoal,
        fatGoal: dayMacros.fatGoal,
        caloriesGoal: dayMacros.caloriesGoal,
      }),
    [mealTemplates, dayMacros],
  );

  const selectedRow =
    mealRows.find((r) => r.diarySlot === slot) ?? mealRows[0] ?? null;

  const eaten: SlotEaten = slotEaten ?? {
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    calories: 0,
  };

  const portionPreset = useMemo(() => {
    if (!product) return null;
    const d = defaultPortionForProduct(product);
    if (d.unit === "pcs") {
      return {
        amount: d.amount,
        unit: d.unit as FoodAmountUnit,
        label: `${d.amount} porcja`,
      };
    }
    const grams =
      product.packageAmount && product.packageUnit === "g"
        ? product.packageAmount
        : d.unit === "g"
          ? d.amount
          : 150;
    return {
      amount: grams,
      unit: "g" as const,
      label: `1 porcja (${grams} g)`,
    };
  }, [product]);

  function bump(delta: number) {
    const cur = Number.isFinite(amount) && amount > 0 ? amount : 0;
    const step = unit === "pcs" ? 1 : 10;
    const next = Math.max(unit === "pcs" ? 1 : 1, Math.round((cur + delta * step) * 10) / 10);
    setAmountStr(String(next));
  }

  if (!open || !mounted || !product) return null;

  const brandLine = [product.brand?.trim(), product.barcode ? `EAN ${product.barcode}` : null]
    .filter(Boolean)
    .join(" · ");

  const amountUnitLabel = unit === "pcs" ? "szt." : unit;

  return createPortal(
    <div className="fixed inset-0 z-[180] flex flex-col bg-black text-white">
      <header className="flex shrink-0 items-center gap-1 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Wróć"
          onClick={onClose}
          className="inline-flex h-10 items-center gap-0.5 rounded-full pr-2 text-white/90"
        >
          <ChevronLeft className="h-6 w-6" />
          <span className="text-[15px] font-medium">Wróć</span>
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28">
        {/* Produkt + kcal */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {brandLine ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {brandLine}
              </p>
            ) : null}
            <h1
              className="notranslate mt-1.5 font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-white"
              translate="no"
            >
              {product.name}
            </h1>
          </div>
          <div className="shrink-0 pt-1 text-right">
            <p className="font-display text-[28px] font-semibold leading-none tabular-nums text-white">
              {macros ? fmt0(macros.calories) : "—"}{" "}
              <span className="text-[16px] font-medium text-white/70">kcal</span>
            </p>
            <p className="mt-1 text-[12px] text-white/40">
              w {Number.isFinite(amount) ? fmt0(amount) : "—"} {amountUnitLabel}
            </p>
          </div>
        </div>

        {/* 01 ILE */}
        <section className="mt-7">
          <p className="font-display text-[12px] font-semibold tracking-[0.08em] text-[var(--gym-gold)]">
            01 ILE
          </p>
          <div className="mt-3 rounded-[20px] border border-white/[0.08] bg-[#161616] px-3 py-4">
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Zmniejsz"
                onClick={() => bump(-1)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/12 bg-black/30 text-white/80"
              >
                <Minus className="h-5 w-5" />
              </button>
              <div className="min-w-[5.5rem] text-center">
                <input
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full bg-transparent text-center font-display text-[40px] font-semibold leading-none tabular-nums text-white outline-none"
                  aria-label="Ilość"
                />
                <p className="mt-1 text-[13px] text-white/40">{amountUnitLabel}</p>
              </div>
              <button
                type="button"
                aria-label="Zwiększ"
                onClick={() => bump(1)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/12 bg-black/30 text-white/80"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {(unit === "g" || unit === "ml") && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {GRAM_CHIPS.map((g) => {
                  const active =
                    unit === "g" && Math.abs(amount - g) < 0.01;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setUnit("g");
                        setAmountStr(String(g));
                      }}
                      className={cn(
                        "h-9 rounded-full border px-3.5 text-[13px] font-semibold tabular-nums transition",
                        active
                          ? "border-[var(--gym-gold)] text-[var(--gym-gold)]"
                          : "border-white/12 text-white/65 hover:border-white/25",
                      )}
                    >
                      {g} g
                    </button>
                  );
                })}
              </div>
            )}

            {portionPreset ? (
              <button
                type="button"
                onClick={() => {
                  setUnit(portionPreset.unit);
                  setAmountStr(String(portionPreset.amount));
                }}
                className={cn(
                  "mt-3 inline-flex h-10 w-full items-center justify-center rounded-full border px-3 text-[13px] font-semibold transition",
                  unit === portionPreset.unit &&
                    Math.abs(amount - portionPreset.amount) < 0.01
                    ? "border-[var(--gym-gold)] text-[var(--gym-gold)]"
                    : "border-white/12 text-white/65",
                )}
              >
                {portionPreset.label}
                {portionPreset.unit === "g"
                  ? ` · ${portionPreset.amount} g`
                  : ""}
              </button>
            ) : null}
          </div>

          {macros && per100 ? (
            <div className="mt-4">
              <div className="grid grid-cols-4 gap-2 text-center">
                {(
                  [
                    ["Białko", `${fmt1(macros.proteinG)} g`],
                    ["Węgle", `${fmt1(macros.carbsG)} g`],
                    ["Tłuszcz", `${fmt1(macros.fatG)} g`],
                    ["kcal", fmt0(macros.calories)],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <p className="font-display text-[22px] font-semibold leading-none tabular-nums text-white">
                      {value}
                    </p>
                    <p className="mt-1.5 text-[11px] text-white/40">{label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-[11px] tabular-nums text-white/35">
                Na 100 g: B {fmt1(per100.proteinG)} · W {fmt1(per100.carbsG)} · T{" "}
                {fmt1(per100.fatG)} · {fmt0(per100.calories)} kcal
              </p>
            </div>
          ) : null}
        </section>

        {/* 02 POSIŁEK */}
        <section className="mt-8">
          <p className="font-display text-[12px] font-semibold tracking-[0.08em] text-[var(--gym-gold)]">
            02 DO KTÓREGO POSIŁKU
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {MEAL_PLAN_DIARY_SLOTS.map((s, i) => {
              const active = slot === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSlotChange?.(s)}
                  className={cn(
                    "h-9 rounded-full border px-3.5 text-[13px] font-semibold transition",
                    active
                      ? "border-[var(--gym-gold)] text-[var(--gym-gold)]"
                      : "border-white/12 text-white/65 hover:border-white/25",
                  )}
                  title={DIET_DIARY_SLOT_LABELS[s]}
                >
                  Posiłek {i + 1}
                </button>
              );
            })}
          </div>

          {selectedRow && macros ? (
            <div className="mt-3">
              <SlotImpactCard row={selectedRow} eaten={eaten} adding={macros} />
            </div>
          ) : null}
        </section>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[1] border-t border-white/[0.06] bg-black/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        <button
          type="button"
          disabled={pending || !macros}
          onClick={() => {
            if (!macros) return;
            onConfirm({ product, amount, unit, macros });
          }}
          className="gold-btn inline-flex h-12 w-full items-center justify-center rounded-2xl text-[15px] font-bold disabled:opacity-40"
        >
          {pending ? "Dodaję…" : "Dodaj do dziennika"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
