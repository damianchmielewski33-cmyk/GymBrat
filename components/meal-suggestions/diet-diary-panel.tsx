"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Plus, ScanBarcode, UtensilsCrossed } from "lucide-react";
import { MacroProgressHero } from "@/components/meal-suggestions/macro-progress-hero";
import {
  DIET_DIARY_SLOT_LABELS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import {
  buildMealPlanRows,
  type MealPlanRow,
} from "@/lib/diet-recipe-match";
import type { MealLogDto } from "@/lib/meal-logs";
import type { MealTemplate } from "@/lib/meal-templates";
import { hapticTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const DIARY_GOLD_RGB = "221, 187, 109";

const springCard = { type: "spring" as const, stiffness: 320, damping: 26 };

function slotTotals(entries: MealLogDto[]) {
  return {
    kcal: entries.reduce((s, e) => s + e.calories, 0),
    protein: entries.reduce((s, e) => s + e.proteinG, 0),
    carbs: entries.reduce((s, e) => s + e.carbsG, 0),
    fat: entries.reduce((s, e) => s + e.fatG, 0),
  };
}

function MealActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
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
      whileTap={{ scale: 0.88 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full",
        "border border-[rgba(221,187,109,0.42)] text-[#DDBB6D]",
        "bg-white/[0.02] shadow-[0_0_0_0_rgba(221,187,109,0)]",
        "transition-[box-shadow,background-color] duration-200",
        "hover:bg-[rgba(221,187,109,0.1)] hover:shadow-[0_0_16px_rgba(221,187,109,0.28)]",
        "active:shadow-[0_0_20px_rgba(221,187,109,0.4)]",
      )}
    >
      {children}
    </motion.button>
  );
}

function MealSlotCard({
  row,
  entries,
  expanded,
  index,
  onToggle,
  onScan,
  onOpenCatalog,
  onAddManual,
  onEditLog,
  onDeleted,
  DeleteMealButton,
}: {
  row: MealPlanRow;
  entries: MealLogDto[];
  expanded: boolean;
  index: number;
  onToggle: () => void;
  onScan: (slot: DietDiarySlot) => void;
  onOpenCatalog: (slot: DietDiarySlot) => void;
  onAddManual: (slot: DietDiarySlot) => void;
  onEditLog: (entry: MealLogDto) => void;
  onDeleted: () => void;
  DeleteMealButton: React.ComponentType<{
    id: string;
    name?: string | null;
    onDone: () => void;
  }>;
}) {
  const eaten = slotTotals(entries);
  const targetKcal = Math.round(row.calories);
  const slotLabel = DIET_DIARY_SLOT_LABELS[row.diarySlot];
  const entryCount = entries.length;
  const macroCells = [
    {
      key: "kcal",
      value: `${Math.round(eaten.kcal)}/${targetKcal}`,
      label: "kcal",
    },
    { key: "B", value: String(Math.round(eaten.protein)), label: "B" },
    { key: "W", value: String(Math.round(eaten.carbs)), label: "W" },
    { key: "T", value: String(Math.round(eaten.fat)), label: "T" },
  ] as const;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springCard, delay: 0.55 + index * 0.05 }}
      whileTap={{ scale: 1.015 }}
      className={cn(
        "overflow-hidden rounded-[20px] border border-white/[0.07]",
        "bg-[#0E0E0E]/95",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_12px_40px_rgba(0,0,0,0.45)]",
        "transition-[box-shadow] duration-200",
        "active:shadow-[0_0_0_1px_rgba(221,187,109,0.28),0_0_28px_rgba(221,187,109,0.14)]",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-3.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`diet-slot-${row.diarySlot}`}
          className="min-w-0 flex-1 space-y-1.5 rounded-xl py-0.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
        >
          <h3 className="truncate text-[14px] font-semibold leading-tight tracking-tight text-white">
            Posiłek {row.index}
          </h3>
          <div className="grid w-full grid-cols-4 gap-x-0 font-metric tabular-nums">
            {macroCells.map((cell, i) => (
              <div
                key={cell.key}
                className={cn(
                  "min-w-0 px-1 first:pl-0 last:pr-0",
                  i > 0 && "border-l border-white/[0.08]",
                )}
              >
                <p className="truncate text-[13px] font-semibold leading-none text-white">
                  {cell.value}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                    cell.key === "kcal" ? "text-white/40" : "text-[#DDBB6D]",
                  )}
                >
                  {cell.label}
                </p>
              </div>
            ))}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <MealActionButton
            label={`Skanuj do ${slotLabel}`}
            onClick={() => onScan(row.diarySlot)}
          >
            <ScanBarcode className="h-4 w-4" />
          </MealActionButton>
          <MealActionButton
            label={`Przepisy do ${slotLabel}`}
            onClick={() => onOpenCatalog(row.diarySlot)}
          >
            <UtensilsCrossed className="h-4 w-4" />
          </MealActionButton>
          <MealActionButton
            label={`Dodaj ręcznie do ${slotLabel}`}
            onClick={() => onAddManual(row.diarySlot)}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </MealActionButton>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={`diet-slot-${row.diarySlot}`}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.22, ease: "easeOut" },
            }}
            className="overflow-hidden"
          >
            {entryCount > 0 ? (
              <ul className="divide-y divide-white/[0.05] border-t border-white/[0.06]">
                {entries.map((e, i) => (
                  <motion.li
                    key={e.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.22,
                      delay: Math.min(i, 6) * 0.035,
                      ease: "easeOut",
                    }}
                    className="flex items-start gap-2 px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white/85">
                        {e.name?.trim() || "Posiłek"}
                      </p>
                      <p className="text-[11px] tabular-nums text-white/40">
                        {Math.round(e.calories)} kcal · B
                        {Math.round(e.proteinG)} W{Math.round(e.carbsG)} T
                        {Math.round(e.fatG)}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Edytuj"
                      onClick={() => onEditLog(e)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <DeleteMealButton
                      id={e.id}
                      name={e.name}
                      onDone={onDeleted}
                    />
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-white/[0.06] px-3.5 py-3.5 text-[13px] text-white/40">
                Brak produktów — dodaj skanem, z przepisów albo ręcznie.
              </p>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
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

  const [expandedSlot, setExpandedSlot] = useState<DietDiarySlot | null>(null);

  return (
    <div className="space-y-3.5">
      <MacroProgressHero
        label="Zjedzone"
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

      {/* Apple Pay–style scan CTA */}
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.42 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          hapticTap();
          onScan(defaultScanSlot);
        }}
        className={cn(
          "relative inline-flex h-12 w-full items-center justify-center gap-2.5 overflow-hidden",
          "rounded-full text-[13px] font-bold uppercase tracking-[0.08em]",
          "text-[#1A1408]",
          "transition-[filter] duration-150",
        )}
        style={{
          backgroundImage:
            "linear-gradient(168deg, #F5E4A3 0%, #E4C56D 42%, #D1A84A 100%)",
          boxShadow: `
            0 1px 0 rgba(255,255,255,0.55) inset,
            0 -2px 0 rgba(90,60,0,0.22) inset,
            0 8px 28px rgba(${DIARY_GOLD_RGB}, 0.38),
            0 0 40px rgba(${DIARY_GOLD_RGB}, 0.18)
          `,
        }}
      >
        <ScanBarcode className="h-5 w-5" strokeWidth={2.25} />
        Skanuj kod kreskowy
      </motion.button>

      <div className="space-y-2.5">
        {rows.map((row, index) => (
          <MealSlotCard
            key={row.id}
            row={row}
            index={index}
            entries={bySlot[row.diarySlot] ?? []}
            expanded={expandedSlot === row.diarySlot}
            onToggle={() =>
              setExpandedSlot((cur) =>
                cur === row.diarySlot ? null : row.diarySlot,
              )
            }
            onScan={onScan}
            onOpenCatalog={onOpenCatalog}
            onAddManual={onAddManual}
            onEditLog={onEditLog}
            onDeleted={onDeleted}
            DeleteMealButton={DeleteMealButton}
          />
        ))}
      </div>
    </div>
  );
}
