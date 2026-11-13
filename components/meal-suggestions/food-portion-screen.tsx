"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, ChevronLeft, Minus, Plus, ShieldAlert } from "lucide-react";
import { FoodQualityCard, QualityVerdictBadge } from "@/components/meal-suggestions/food-quality-card";
import { computeFoodQuality, computeSaltInfo } from "@/lib/food-quality";
import { GisProductAlert } from "@/components/meal-suggestions/gis-product-alert";
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
  const usedPct =
    left.calories > 0 ? Math.min(100, Math.round((adding.calories / left.calories) * 100)) : 100;

  let closeHint: string | null = null;
  if (adding.proteinG > 0 && left.proteinG > 0 && adding.effectiveGrams != null) {
    const needG = Math.ceil(left.proteinG * (adding.effectiveGrams / adding.proteinG));
    if (needG > 0 && Number.isFinite(needG)) closeHint = `${needG} g domyka białko`;
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#161616] px-4 py-3.5">
      <div className="flex justify-between text-[12px] text-white/60">
        <span>W posiłku zostało</span>
        <span>Po dodaniu</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="font-display text-[30px] leading-none tabular-nums text-white">
          {fmt0(left.calories)} <span className="text-[15px] text-white/70">kcal</span>
        </span>
        <ArrowRight className="h-5 w-5 self-center text-white/60" aria-hidden />
        <span className="font-display text-[30px] leading-none tabular-nums text-[var(--gym-gold-bright)]">
          {fmt0(after.calories)} <span className="text-[15px] text-white/70">kcal</span>
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <div className="h-full bg-[var(--gym-gold)]" style={{ width: `${usedPct}%` }} />
      </div>
      <p className="mt-2.5 text-[12px] leading-snug tabular-nums text-white/70">
        Zostanie: B {fmt0(after.proteinG)} g · W {fmt0(after.carbsG)} g · T {fmt0(after.fatG)} g
        {closeHint ? ` · ${closeHint}` : ""}
      </p>
    </div>
  );
}

function sourceLabel(source: FoodProduct["source"]): string {
  if (source === "openfoodfacts") return "Źródło: Open Food Facts";
  if (source === "usda") return "Źródło: USDA";
  return "Baza GymBrat";
}

function MacroTile({
  label,
  value,
  pct,
}: {
  label: string;
  value: number;
  pct: number | null;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#161616] px-3 pb-2.5 pt-3">
      <p className="font-display text-[28px] leading-none tabular-nums text-white">
        {fmt1(value)} <span className="text-[16px] text-white/70">g</span>
      </p>
      <p className="mt-1 text-[12px] text-white/60">{label}</p>
      {pct != null ? (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <div className="h-full bg-[var(--gym-gold)]" style={{ width: `${pct}%` }} />
        </div>
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
  const [gisCount, setGisCount] = useState(0);

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

  const amountUnitLabel = unit === "pcs" ? "szt." : unit === "ml" ? "ml" : "gramów";
  const quality = computeFoodQuality(product);
  const salt = computeSaltInfo(product, macros?.effectiveGrams ?? null);
  const slotIndex = Math.max(0, MEAL_PLAN_DIARY_SLOTS.indexOf(slot)) + 1;
  const left = selectedRow
    ? {
        p: Math.max(0, selectedRow.proteinG - eaten.proteinG),
        c: Math.max(0, selectedRow.carbsG - eaten.carbsG),
        f: Math.max(0, selectedRow.fatG - eaten.fatG),
      }
    : null;
  const pctOf = (v: number, total: number | undefined) =>
    total && total > 0 ? Math.min(100, Math.round((v / total) * 100)) : null;
  const ctaNote =
    gisCount > 0
      ? "uwaga: alert GIS"
      : salt
        ? `sól ${salt.dailyPct}% limitu`
        : quality
          ? `ocena ${quality.grade}`
          : null;
  const chipBase =
    "inline-flex h-11 items-center justify-center rounded-full border px-4 text-[14px] font-semibold transition";
  const chipOn = "border-[var(--gym-gold)] bg-[var(--gym-gold)]/10 text-[var(--gym-gold-bright)]";
  const chipOff = "border-white/14 text-white/80 hover:border-white/25";

  return createPortal(
    <div className="fixed inset-0 z-[180] flex flex-col bg-black text-white">
      <header className="flex shrink-0 items-center justify-between gap-2 px-2 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Wróć"
          onClick={onClose}
          className="inline-flex h-11 items-center gap-0.5 rounded-full pl-1 pr-3 text-white/90"
        >
          <ChevronLeft className="h-6 w-6" />
          <span className="text-[15px] font-medium">Wróć</span>
        </button>
        <span className="mr-2 rounded-full border border-white/14 px-2.5 py-1 text-[11px] text-white/60">
          {sourceLabel(product.source)}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 pb-32">
        {/* Produkt + werdykt */}
        <div className="flex items-start justify-between gap-3 pt-2">
          <div className="min-w-0 flex-1">
            {brandLine ? (
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                {brandLine}
              </p>
            ) : null}
            <h1
              className="notranslate mt-1.5 font-display text-[44px] font-normal uppercase leading-none tracking-[0.01em] text-white"
              translate="no"
            >
              {product.name}
            </h1>
            <p className="mt-1.5 text-[13px] text-white/60">
              <span className="font-display text-[26px] tracking-[0.02em] text-white">
                {macros ? fmt0(macros.calories) : "—"}
              </span>{" "}
              kcal · w {Number.isFinite(amount) ? fmt0(amount) : "—"} {unit === "pcs" ? "szt." : unit}
            </p>
          </div>
          {quality ? <QualityVerdictBadge quality={quality} /> : null}
        </div>

        <GisProductAlert product={product} onMatch={setGisCount} />

        {/* 01 ILE */}
        <section className="mt-6">
          <p className="font-heading text-[12px] font-bold tracking-[0.1em] text-[var(--gym-gold)]">
            01 · ILE
          </p>
          <div className="mt-3 rounded-3xl border border-white/[0.08] bg-[#161616] px-3.5 pb-3.5 pt-[18px]">
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Zmniejsz ilość"
                onClick={() => bump(-1)}
                className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-white/14 bg-black/35 text-white"
              >
                <Minus className="h-5 w-5" />
              </button>
              <div className="min-w-[110px] text-center">
                <input
                  inputMode="decimal"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full bg-transparent text-center font-display text-[60px] leading-none tabular-nums text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/60"
                  aria-label="Ilość"
                />
                <p className="mt-0.5 text-[13px] text-white/60">{amountUnitLabel}</p>
              </div>
              <button
                type="button"
                aria-label="Zwiększ ilość"
                onClick={() => bump(1)}
                className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-white/14 bg-black/35 text-white"
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>

            {(unit === "g" || unit === "ml") && (
              <div className="mt-3.5 flex flex-wrap justify-center gap-2">
                {GRAM_CHIPS.map((g) => {
                  const active = unit === "g" && Math.abs(amount - g) < 0.01;
                  return (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setUnit("g");
                        setAmountStr(String(g));
                      }}
                      className={cn(chipBase, "min-w-16 tabular-nums", active ? chipOn : chipOff)}
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
                  chipBase,
                  "mt-2.5 w-full",
                  unit === portionPreset.unit && Math.abs(amount - portionPreset.amount) < 0.01
                    ? chipOn
                    : chipOff,
                )}
              >
                {portionPreset.label}
              </button>
            ) : null}
          </div>

          {macros && per100 ? (
            <>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <MacroTile label="Białko" value={macros.proteinG} pct={left ? pctOf(macros.proteinG, left.p) : null} />
                <MacroTile label="Węgle" value={macros.carbsG} pct={left ? pctOf(macros.carbsG, left.c) : null} />
                <MacroTile label="Tłuszcz" value={macros.fatG} pct={left ? pctOf(macros.fatG, left.f) : null} />
              </div>
              <p className="mt-2.5 text-center text-[12px] tabular-nums text-white/60">
                Na 100 g: B {fmt1(per100.proteinG)} · W {fmt1(per100.carbsG)} · T {fmt1(per100.fatG)} ·{" "}
                {fmt0(per100.calories)} kcal
              </p>
            </>
          ) : null}
        </section>

        {/* 02 JAKOŚĆ */}
        <section id="jakosc" className="mt-7 scroll-mt-4">
          <p className="font-heading text-[12px] font-bold tracking-[0.1em] text-[var(--gym-gold)]">
            02 · JAKOŚĆ PRODUKTU
          </p>
          <div className="mt-3">
            <FoodQualityCard product={product} effectiveGrams={macros?.effectiveGrams ?? null} />
          </div>
          <Link
            href="/meal-suggestions/alerty-gis"
            className="mt-1.5 inline-flex min-h-[44px] items-center gap-2 text-[13px] text-white/70 underline underline-offset-3"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden /> Alerty GIS — wycofane produkty
          </Link>
        </section>

        {/* 03 POSIŁEK */}
        <section className="mt-5">
          <p className="font-heading text-[12px] font-bold tracking-[0.1em] text-[var(--gym-gold)]">
            03 · DO KTÓREGO POSIŁKU
          </p>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {MEAL_PLAN_DIARY_SLOTS.map((s, i) => {
              const active = slot === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSlotChange?.(s)}
                  className={cn(chipBase, "shrink-0", active ? chipOn : chipOff)}
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

      <div className="absolute inset-x-0 bottom-0 z-[1] border-t border-white/[0.06] bg-black/90 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        {macros ? (
          <p className="mb-2 text-center text-[12px] tabular-nums text-white/70" aria-live="polite">
            +{fmt0(macros.calories)} kcal · Posiłek {slotIndex}
            {ctaNote ? ` · ${ctaNote}` : ""}
          </p>
        ) : null}
        <button
          type="button"
          disabled={pending || !macros}
          onClick={() => {
            if (!macros) return;
            onConfirm({ product, amount, unit, macros });
          }}
          className="gold-btn inline-flex h-[52px] w-full items-center justify-center rounded-2xl font-heading text-[16px] font-bold disabled:opacity-40"
        >
          {pending ? "Dodaję…" : "Dodaj do dziennika"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
