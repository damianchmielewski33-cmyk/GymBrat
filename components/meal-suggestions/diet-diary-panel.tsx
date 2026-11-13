"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Plus, ScanBarcode, UtensilsCrossed } from "lucide-react";
import { MacroProgressHero } from "@/components/meal-suggestions/macro-progress-hero";
import {
  DIET_DIARY_SLOT_LABELS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";

const DIET_DIARY_SLOT_KEYS = Object.keys(
  DIET_DIARY_SLOT_LABELS,
) as DietDiarySlot[];
import {
  buildMealPlanRows,
  type MealPlanRow,
} from "@/lib/diet-recipe-match";
import type { MealLogDto } from "@/lib/meal-logs";
import type { MealTemplate } from "@/lib/meal-templates";
import { hapticTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

function slotTotals(entries: MealLogDto[]) {
  return {
    kcal: entries.reduce((s, e) => s + e.calories, 0),
    protein: entries.reduce((s, e) => s + e.proteinG, 0),
    carbs: entries.reduce((s, e) => s + e.carbsG, 0),
    fat: entries.reduce((s, e) => s + e.fatG, 0),
  };
}

function IconAction({
  label,
  onClick,
  primary,
  children,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      onClick={() => {
        hapticTap();
        onClick();
      }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 520, damping: 24 }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors",
        primary
          ? "gold-btn h-11 w-11 text-black"
          : "h-10 w-10 border border-white/[0.1] bg-white/[0.04] text-[var(--gym-gold)] hover:bg-white/[0.08]",
      )}
    >
      {children}
    </motion.button>
  );
}

function MealSlotCard({
  row,
  entries,
  index,
  onScan,
  onOpenCatalog,
  onAddManual,
  onEditLog,
  onDeleted,
  remainingKcal,
  DeleteMealButton,
}: {
  row: MealPlanRow;
  remainingKcal: number | null;
  entries: MealLogDto[];
  index: number;
  onScan: (slot: DietDiarySlot) => void;
  onOpenCatalog: (slot: DietDiarySlot) => void;
  onAddManual: (slot: DietDiarySlot) => void;
  onEditLog: (entry: MealLogDto) => void;
  onDeleted: () => void;
  DeleteMealButton: React.ComponentType<{
    id: string;
    name?: string | null;
    calories?: number;
    remainingKcal?: number | null;
    onDone: () => void;
  }>;
}) {
  const eaten = slotTotals(entries);
  const targetKcal = Math.round(row.calories);
  const slotLabel = DIET_DIARY_SLOT_LABELS[row.diarySlot];
  const pct =
    targetKcal > 0 ? Math.min(100, (eaten.kcal / targetKcal) * 100) : 0;
  const over = targetKcal > 0 && eaten.kcal > targetKcal;

  return (
    <motion.section
      aria-label={`Posiłek ${row.index}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.28,
        delay: Math.min(index, 5) * 0.04,
        ease: "easeOut",
      }}
      className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] shadow-[0_10px_30px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center gap-2 px-3.5 pb-3 pt-3">
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] font-metric text-[15px] font-semibold text-[var(--gym-gold)]"
        >
          {row.index}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-white">
            {slotLabel}
          </h3>
          <p className="mt-0.5 text-[12px] tabular-nums text-white/55">
            <span
              className={cn(
                "font-semibold",
                over ? "text-state-warning" : "text-white",
              )}
            >
              {Math.round(eaten.kcal)}
            </span>
            {" / "}
            {targetKcal} kcal
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconAction
            label={`Skanuj do ${slotLabel}`}
            onClick={() => onScan(row.diarySlot)}
          >
            <ScanBarcode className="h-[18px] w-[18px]" />
          </IconAction>
          <IconAction
            label={`Przepisy do ${slotLabel}`}
            onClick={() => onOpenCatalog(row.diarySlot)}
          >
            <UtensilsCrossed className="h-[18px] w-[18px]" />
          </IconAction>
          <IconAction
            primary
            label={`Dodaj do ${slotLabel}`}
            onClick={() => onAddManual(row.diarySlot)}
          >
            <Plus className="h-5 w-5" strokeWidth={2.75} />
          </IconAction>
        </div>
      </div>

      <div
        className="mx-3.5 h-1 overflow-hidden rounded-full bg-white/[0.08]"
        aria-hidden
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
            over ? "bg-state-warning" : "gym-meter-gold",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {entries.length > 0 ? (
        <>
          <p className="mt-2.5 px-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] tabular-nums">
            <span className="text-sky-300">B {Math.round(eaten.protein)}</span>
            <span className="text-white/50">{"  ·  "}</span>
            <span className="text-state-warning">W {Math.round(eaten.carbs)}</span>
            <span className="text-white/50">{"  ·  "}</span>
            <span className="text-state-error">T {Math.round(eaten.fat)}</span>
          </p>
          <ul className="mt-2 border-t border-white/[0.06]">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-1 border-b border-white/[0.05] pl-3.5 pr-2 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => onEditLog(e)}
                  aria-label={`Edytuj: ${e.name?.trim() || "Posiłek"}`}
                  className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 py-2 text-left active:bg-white/[0.03]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-white">
                      {e.name?.trim() || "Posiłek"}
                    </span>
                    <span className="mt-0.5 block text-[11px] tabular-nums text-white/50">
                      B {Math.round(e.proteinG)} · W {Math.round(e.carbsG)} · T{" "}
                      {Math.round(e.fatG)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums text-[var(--gym-gold)]">
                    {Math.round(e.calories)}
                    <span className="ml-0.5 text-[10px] font-medium text-white/55">
                      kcal
                    </span>
                  </span>
                </button>
                <DeleteMealButton
                  id={e.id}
                  name={e.name}
                  calories={e.calories}
                  remainingKcal={remainingKcal}
                  onDone={onDeleted}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <button
          type="button"
          onClick={() => {
            hapticTap();
            onAddManual(row.diarySlot);
          }}
          className="mt-1 flex min-h-[44px] w-full items-center gap-2 px-3.5 text-left text-[13px] text-white/50 active:text-white/80"
        >
          <Plus className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
          Dodaj pierwszy produkt
        </button>
      )}
      <div className="h-1.5" aria-hidden />
    </motion.section>
  );
}

export function DietDiaryPanel({
  bySlot,
  dayMacros,
  mealTemplates = [],
  defaultScanSlot,
  onScan,
  onOpenCatalog,
  onAddManual,
  onEditLog,
  onDeleted,
  DeleteMealButton,
}: {
  bySlot: Record<DietDiarySlot, MealLogDto[]>;
  dayMacros: {
    caloriesConsumed: number;
    caloriesGoal: number | null;
    proteinConsumed: number;
    proteinGoal: number | null;
    fatConsumed: number;
    fatGoal: number | null;
    carbsConsumed: number;
    carbsGoal: number | null;
    caloriesRemaining: number | null;
  };
  mealTemplates?: MealTemplate[];
  defaultScanSlot: DietDiarySlot;
  onScan: (slot: DietDiarySlot) => void;
  onOpenCatalog: (slot: DietDiarySlot) => void;
  onAddManual: (slot: DietDiarySlot) => void;
  onEditLog: (entry: MealLogDto) => void;
  onDeleted: () => void;
  DeleteMealButton: React.ComponentType<{
    id: string;
    name?: string | null;
    calories?: number;
    remainingKcal?: number | null;
    onDone: () => void;
  }>;
}) {
  const rows = useMemo(
    () =>
      buildMealPlanRows(mealTemplates, {
        proteinGoal: dayMacros.proteinGoal,
        carbsGoal: dayMacros.carbsGoal,
        fatGoal: dayMacros.fatGoal,
        caloriesGoal: dayMacros.caloriesGoal,
      }),
    [mealTemplates, dayMacros],
  );

  const isEmptyDay = DIET_DIARY_SLOT_KEYS.every(
    (k) => (bySlot[k] ?? []).length === 0,
  );

  return (
    <div className="space-y-3">
      <MacroProgressHero
        label="Dzisiaj"
        mode="eaten"
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

      {isEmptyDay ? (
        <div className="rounded-3xl border border-dashed border-white/[0.16] bg-white/[0.02] px-5 py-6 text-center">
          <span
            aria-hidden
            className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-[var(--gym-gold)]"
          >
            <UtensilsCrossed className="h-6 w-6" />
          </span>
          <h2 className="mt-3.5 text-[18px] font-bold text-white">
            Nic tu jeszcze nie ma
          </h2>
          <p className="mx-auto mt-1.5 max-w-[260px] text-[13px] leading-relaxed text-white/60">
            Zeskanuj produkt albo dodaj coś z przepisów, a makro dnia policzy
            się samo.
          </p>
          <div className="mt-4">
      <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              hapticTap();
              onScan(defaultScanSlot);
            }}
            className="gold-btn inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-[13px] font-bold uppercase tracking-[0.08em] text-black"
          >
            <ScanBarcode className="h-5 w-5" strokeWidth={2.25} />
            Skanuj kod kreskowy
          </motion.button>
          </div>
        </div>
      ) : (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          hapticTap();
          onScan(defaultScanSlot);
        }}
        className="gold-btn inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full text-[13px] font-bold uppercase tracking-[0.08em] text-black"
      >
        <ScanBarcode className="h-5 w-5" strokeWidth={2.25} />
        Skanuj kod kreskowy
      </motion.button>

      )}

      <div className="space-y-3">
        {rows.map((row, index) => (
          <MealSlotCard
            key={row.id}
            row={row}
            index={index}
            entries={bySlot[row.diarySlot] ?? []}
            onScan={onScan}
            onOpenCatalog={onOpenCatalog}
            onAddManual={onAddManual}
            onEditLog={onEditLog}
            onDeleted={onDeleted}
            remainingKcal={dayMacros.caloriesRemaining}
            DeleteMealButton={DeleteMealButton}
          />
        ))}
      </div>
    </div>
  );
}
