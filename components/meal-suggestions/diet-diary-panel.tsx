"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pencil, Plus, ScanBarcode, UtensilsCrossed } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
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
import { cn } from "@/lib/utils";

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
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--gym-gold)]/45 text-[var(--gym-gold)] hover:bg-[var(--gym-gold)]/10"
    >
      {children}
    </button>
  );
}

function MealSlotCard({
  row,
  entries,
  expanded,
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
    {
      key: "B",
      value: String(Math.round(row.proteinG)),
      label: "B",
    },
    {
      key: "W",
      value: String(Math.round(row.carbsG)),
      label: "W",
    },
    {
      key: "T",
      value: String(Math.round(row.fatG)),
      label: "T",
    },
  ] as const;

  return (
    <section className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#141414]">
      <div className="flex items-start gap-2 px-3 py-3 sm:gap-2.5 sm:px-3.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`diet-slot-${row.diarySlot}`}
          className="min-w-0 flex-1 space-y-2.5 rounded-xl py-0.5 text-left transition-colors hover:bg-white/[0.03] active:bg-white/[0.05]"
        >
          <h3 className="truncate text-[15px] font-semibold text-white">
            Posiłek {row.index}
          </h3>
          <div className="grid w-full grid-cols-4 gap-x-1.5 font-metric tabular-nums">
            {macroCells.map((cell, i) => (
              <div
                key={cell.key}
                className={cn(
                  "min-w-0",
                  i > 0 && "border-l border-white/[0.08] pl-1.5",
                )}
              >
                <p className="truncate text-[13px] font-semibold leading-none text-white">
                  {cell.value}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                    cell.key === "kcal"
                      ? "text-white/40"
                      : "text-[var(--gym-gold)]",
                  )}
                >
                  {cell.label}
                </p>
              </div>
            ))}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
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
    </section>
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

  const kcalGoal = dayMacros.caloriesGoal;
  const kcalEaten = Math.round(dayMacros.caloriesConsumed);
  const kcalDelta =
    kcalGoal != null ? Math.round(kcalEaten - kcalGoal) : null;
  const overGoal = kcalDelta != null && kcalDelta > 0;
  const kcalPct =
    kcalGoal != null && kcalGoal > 0
      ? Math.min(100, Math.round((kcalEaten / kcalGoal) * 100))
      : 0;

  const macroLines = [
    {
      key: "B",
      consumed: dayMacros.proteinConsumed,
      goal: dayMacros.proteinGoal,
    },
    {
      key: "W",
      consumed: dayMacros.carbsConsumed,
      goal: dayMacros.carbsGoal,
    },
    {
      key: "T",
      consumed: dayMacros.fatConsumed,
      goal: dayMacros.fatGoal,
    },
  ] as const;

  /** Jednocześnie jeden otwarty posiłek — czytelniejszy dziennik. */
  const [expandedSlot, setExpandedSlot] = useState<DietDiarySlot | null>(null);

  return (
    <div className="space-y-4">
      <section className="app-card relative overflow-hidden px-4 py-4">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gym-gold)]/55 to-transparent"
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          Zjedzone
        </p>

        {/* Jak makieta: kcal + B/W/T wypełniają kafelek (bez pustej dziury). */}
        <div className="mt-3 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-center gap-x-3 sm:gap-x-4">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <AnimatedMetric
                value={kcalEaten}
                className="text-[40px] leading-none text-white sm:text-[44px]"
              />
              <span className="font-metric text-[16px] text-white/55">kcal</span>
            </div>
            {kcalGoal != null ? (
              <p
                className={cn(
                  "mt-1.5 text-[13px] tabular-nums",
                  overGoal ? "text-rose-300" : "text-white/50",
                )}
              >
                z {Math.round(kcalGoal)} kcal ·{" "}
                {kcalDelta != null && kcalDelta > 0 ? "+" : ""}
                {kcalDelta}
              </p>
            ) : (
              <p className="mt-1.5 text-[13px] text-white/45">
                Ustaw cel w profilu
              </p>
            )}
          </div>

          <div className="min-w-0 space-y-1.5 font-metric text-[14px] leading-none tabular-nums text-white">
            {macroLines.map((m) => {
              const over =
                m.goal != null && m.consumed > m.goal;
              return (
                <div
                  key={m.key}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className="text-[12px] font-semibold text-white/45">
                    {m.key}
                  </span>
                  <span
                    className={cn(
                      "text-right",
                      over ? "text-rose-300" : "text-white",
                    )}
                  >
                    {Math.round(m.consumed)}
                    {m.goal != null ? (
                      <span className="text-white/40">
                        {" "}
                        / {Math.round(m.goal)} g
                      </span>
                    ) : (
                      <span className="text-white/40"> g</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-700 ease-out",
              overGoal ? "bg-rose-400" : "bg-[var(--gym-gold)]",
            )}
            style={{ width: `${kcalPct}%` }}
          />
        </div>
      </section>

      <button
        type="button"
        onClick={() => onScan(defaultScanSlot)}
        className="gold-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold shadow-[0_0_36px_rgba(235,196,74,0.35)]"
      >
        <ScanBarcode className="h-5 w-5" />
        Skanuj kod kreskowy
      </button>

      <div className="space-y-2.5">
        {rows.map((row) => (
          <MealSlotCard
            key={row.id}
            row={row}
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
