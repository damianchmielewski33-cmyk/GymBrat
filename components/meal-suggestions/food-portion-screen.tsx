"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Heart } from "lucide-react";
import type { FoodAmountUnit, FoodProduct } from "@/lib/food-products-types";
import {
  defaultPortionForProduct,
  resolveProductBasis,
  scaleFoodMacros,
  type FoodPortionMacros,
} from "@/lib/food-portion";
import { DietDayMacrosBar } from "@/components/meal-suggestions/diet-day-macros-bar";
import {
  DIET_DIARY_SLOT_LABELS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import { cn } from "@/lib/utils";

function CircleMacro({
  value,
  label,
  ring,
}: {
  value: string;
  label: string;
  ring: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums text-white",
          ring,
        )}
      >
        {value}
      </div>
      <p className="text-[10px] text-white/45">{label}</p>
    </div>
  );
}

export function FoodPortionScreen({
  product,
  open,
  onClose,
  slot,
  dateLabel,
  pending,
  dayMacros,
  onConfirm,
}: {
  product: FoodProduct | null;
  open: boolean;
  onClose: () => void;
  slot: DietDiarySlot;
  dateLabel: string;
  pending?: boolean;
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
  onConfirm: (args: {
    product: FoodProduct;
    amount: number;
    unit: FoodAmountUnit;
    macros: FoodPortionMacros;
  }) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [amountStr, setAmountStr] = useState("100");
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

  const presets = useMemo(() => {
    if (!product) return [] as Array<{ amount: number; unit: FoodAmountUnit }>;
    const basis = resolveProductBasis(product);
    const list: Array<{ amount: number; unit: FoodAmountUnit }> = [
      { amount: 100, unit: "g" },
      { amount: basis.amount, unit: basis.unit },
    ];
    if (product.gramsPerPiece) {
      list.push({ amount: 1, unit: "pcs" });
    }
    // unique
    const seen = new Set<string>();
    return list.filter((p) => {
      const k = `${p.amount}-${p.unit}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [product]);

  if (!open || !mounted || !product) return null;

  return createPortal(
    <div className="fixed inset-0 z-[180] flex flex-col bg-[#0c0c0c] text-white">
      <header className="flex items-center gap-2 border-b border-white/10 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          aria-label="Wróć"
          onClick={onClose}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/85"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-base font-semibold text-white">
            {DIET_DIARY_SLOT_LABELS[slot]}
          </p>
          <p className="text-xs text-white/45">{dateLabel}</p>
        </div>
        <span className="w-10" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-[#1a1a14] px-4 py-4">
          <h2 className="text-xl font-semibold leading-snug text-white">{product.name}</h2>
          <Heart className="mt-1 h-5 w-5 shrink-0 text-white/35" aria-hidden />
        </div>

        <div className="mt-4 space-y-1">
          {presets.map((p) => {
            const m = scaleFoodMacros(product, p.amount, p.unit);
            const active =
              unit === p.unit && Math.abs(amount - p.amount) < 0.01;
            return (
              <button
                key={`${p.amount}-${p.unit}`}
                type="button"
                onClick={() => {
                  setAmountStr(String(p.amount));
                  setUnit(p.unit);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-3 text-left",
                  active ? "bg-white/[0.08]" : "hover:bg-white/[0.04]",
                )}
              >
                <span className="text-sm text-white/85">
                  {p.amount} × {p.unit === "pcs" ? "sztuka" : p.unit}
                </span>
                <span className="text-sm tabular-nums text-white/55">
                  {m.calories} kcal
                </span>
              </button>
            );
          })}

          <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-3">
            <input
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="h-10 w-20 rounded-lg border border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15 px-2 text-center text-base font-semibold tabular-nums text-[var(--gym-gold-bright)] outline-none"
              aria-label="Ilość"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as FoodAmountUnit)}
              className="h-10 rounded-lg border border-white/15 bg-black/40 px-2 text-sm text-white outline-none"
              aria-label="Jednostka"
            >
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="pcs">sztuka</option>
            </select>
            <span className="ml-auto text-sm tabular-nums text-white/55">
              {macros ? `${macros.calories} kcal` : "—"}
            </span>
          </div>
        </div>

        {per100 ? (
          <div className="mt-6">
            <p className="mb-3 text-sm text-white/55">W 100 g:</p>
            <div className="flex justify-around">
              <CircleMacro value={String(per100.calories)} label="kcal" ring="border-white/40" />
              <CircleMacro
                value={`${Math.round(per100.proteinG * 10) / 10} g`}
                label="Białko"
                ring="border-sky-400/70"
              />
              <CircleMacro
                value={`${Math.round(per100.fatG * 10) / 10} g`}
                label="Tłuszcz"
                ring="border-amber-400/70"
              />
              <CircleMacro
                value={`${Math.round(per100.carbsG * 10) / 10} g`}
                label="Węglow."
                ring="border-violet-400/70"
              />
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={pending || !macros}
          onClick={() => {
            if (!macros) return;
            onConfirm({ product, amount, unit, macros });
          }}
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-[var(--gym-gold)] text-sm font-semibold text-black disabled:opacity-40"
        >
          {pending ? "Dodaję…" : "Dodaj do dziennika"}
        </button>
      </div>

      <DietDayMacrosBar {...dayMacros} />
    </div>,
    document.body,
  );
}
