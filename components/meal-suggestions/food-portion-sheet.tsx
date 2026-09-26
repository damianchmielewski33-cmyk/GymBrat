"use client";

import { useEffect, useMemo, useState } from "react";
import type { FoodAmountUnit, FoodProduct } from "@/lib/food-products-types";
import {
  defaultPortionForProduct,
  scaleFoodMacros,
} from "@/lib/food-portion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DIET_DIARY_SLOT_LABELS,
  DIET_DIARY_SLOTS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import { cn } from "@/lib/utils";

const UNITS: { id: FoodAmountUnit; label: string }[] = [
  { id: "g", label: "g" },
  { id: "ml", label: "ml" },
  { id: "pcs", label: "szt." },
];

function MacroPill({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-white">
        {Math.round(value * 10) / 10}
        {unit ? (
          <span className="ml-0.5 text-[10px] font-normal text-white/40">{unit}</span>
        ) : null}
      </p>
    </div>
  );
}

export function FoodPortionSheet({
  product,
  open,
  onOpenChange,
  slot,
  onSlotChange,
  lockedSlot,
  pending,
  onConfirm,
}: {
  product: FoodProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: DietDiarySlot;
  onSlotChange: (slot: DietDiarySlot) => void;
  lockedSlot?: DietDiarySlot;
  pending?: boolean;
  onConfirm: (args: {
    product: FoodProduct;
    amount: number;
    unit: FoodAmountUnit;
    macros: ReturnType<typeof scaleFoodMacros>;
  }) => void;
}) {
  const [amountStr, setAmountStr] = useState("100");
  const [unit, setUnit] = useState<FoodAmountUnit>("g");

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

  if (!product) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="border-white/10 bg-[#07070c] text-white">
        <SheetHeader>
          <SheetTitle className="notranslate text-white" translate="no">
            {product.name}
          </SheetTitle>
          <SheetDescription className="text-white/55">
            {[product.brand, product.servingLabel].filter(Boolean).join(" · ")}
            {product.source === "openfoodfacts" ? " · Open Food Facts (na 100 g)" : " · baza GymBrat"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
              Ilość
            </p>
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="h-12 flex-1 text-lg tabular-nums"
                aria-label="Ilość"
              />
              <div className="flex rounded-xl border border-white/12 bg-white/[0.04] p-1">
                {UNITS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUnit(u.id)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-semibold",
                      unit === u.id
                        ? "bg-[var(--neon)]/20 text-[var(--gym-gold-bright)]"
                        : "text-white/55",
                    )}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
            {unit === "pcs" && product.gramsPerPiece ? (
              <p className="mt-1.5 text-xs text-white/40">
                1 szt. ≈ {product.gramsPerPiece} g
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <MacroPill label="Kcal" value={macros?.calories ?? 0} unit="" />
            <MacroPill label="Białko" value={macros?.proteinG ?? 0} unit="g" />
            <MacroPill label="Węgle" value={macros?.carbsG ?? 0} unit="g" />
            <MacroPill label="Tłuszcz" value={macros?.fatG ?? 0} unit="g" />
          </div>
          {macros ? (
            <p className="text-xs text-white/40">Dla {macros.label}</p>
          ) : (
            <p className="text-xs text-amber-200/90">Podaj poprawną ilość większą od zera.</p>
          )}

          {!lockedSlot ? (
            <div className="flex flex-wrap gap-2">
              {DIET_DIARY_SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSlotChange(s)}
                  className={
                    slot === s
                      ? "rounded-full border border-[var(--neon)]/40 bg-[var(--neon)]/15 px-3 py-1.5 text-xs font-semibold text-white"
                      : "rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70"
                  }
                >
                  {DIET_DIARY_SLOT_LABELS[s]}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-white/55">
              Sekcja: <span className="text-white">{DIET_DIARY_SLOT_LABELS[slot]}</span>
            </p>
          )}

          <SheetFooter className="flex flex-row gap-2 px-0">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Anuluj
            </Button>
            <Button
              type="button"
              variant="cta"
              className="flex-[1.2]"
              disabled={pending || !macros}
              onClick={() => {
                if (!macros) return;
                onConfirm({ product, amount, unit, macros });
              }}
            >
              Dodaj do dziennika
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
