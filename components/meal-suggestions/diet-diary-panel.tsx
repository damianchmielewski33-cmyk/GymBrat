"use client";

import { useMemo } from "react";
import { Pencil, Plus, ScanBarcode, UtensilsCrossed } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { DietDayMacrosBar } from "@/components/meal-suggestions/diet-day-macros-bar";
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
  onScan,
  onOpenCatalog,
  onAddManual,
  onEditLog,
  onDeleted,
  DeleteMealButton,
}: {
  row: MealPlanRow;
  entries: MealLogDto[];
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
  const targetLine = `B ${Math.round(row.proteinG)} W ${Math.round(row.carbsG)} T ${Math.round(row.fatG)}`;

  return (
    <section className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#141414]">
      <div className="flex items-center gap-2 px-3.5 py-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold text-white">
            Posiłek {row.index}
          </h3>
          <p className="mt-1 text-[12px] tabular-nums text-white/45">
            {Math.round(eaten.kcal)} / {targetKcal} kcal · {targetLine}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <MealActionButton
            label={`Skanuj do ${DIET_DIARY_SLOT_LABELS[row.diarySlot]}`}
            onClick={() => onScan(row.diarySlot)}
          >
            <ScanBarcode className="h-4 w-4" />
          </MealActionButton>
          <MealActionButton
            label={`Przepisy do ${DIET_DIARY_SLOT_LABELS[row.diarySlot]}`}
            onClick={() => onOpenCatalog(row.diarySlot)}
          >
            <UtensilsCrossed className="h-4 w-4" />
          </MealActionButton>
          <MealActionButton
            label={`Dodaj ręcznie do ${DIET_DIARY_SLOT_LABELS[row.diarySlot]}`}
            onClick={() => onAddManual(row.diarySlot)}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </MealActionButton>
        </div>
      </div>

      {entries.length > 0 ? (
        <ul className="divide-y divide-white/[0.05] border-t border-white/[0.06]">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-2 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/85">
                  {e.name?.trim() || "Posiłek"}
                </p>
                <p className="text-[11px] tabular-nums text-white/40">
                  {Math.round(e.calories)} kcal · B{Math.round(e.proteinG)} W
                  {Math.round(e.carbsG)} T{Math.round(e.fatG)}
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
            </li>
          ))}
        </ul>
      ) : null}
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
  const kcalDelta =
    kcalGoal != null
      ? Math.round(dayMacros.caloriesConsumed - kcalGoal)
      : null;
  const overGoal = kcalDelta != null && kcalDelta > 0;

  return (
    <div className="space-y-4">
      <section className="app-card relative overflow-hidden px-4 py-4">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--gym-gold)]/55 to-transparent"
          aria-hidden
        />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Zjedzone dziś
          </p>
          <div className="mt-2 flex items-end gap-2">
            <AnimatedMetric
              value={Math.round(dayMacros.caloriesConsumed)}
              className="text-[44px] leading-none text-white sm:text-[48px]"
            />
            <span className="mb-1.5 font-metric text-[18px] text-white/55">
              kcal
            </span>
          </div>
          {kcalGoal != null ? (
            <p
              className={cn(
                "mt-1.5 text-[13px] tabular-nums",
                overGoal ? "text-rose-300" : "text-white/50",
              )}
            >
              cel {Math.round(kcalGoal)} kcal ·{" "}
              {kcalDelta != null && kcalDelta > 0 ? "+" : ""}
              {kcalDelta} {overGoal ? "nadwyżka" : "zostało"}
            </p>
          ) : (
            <p className="mt-1.5 text-[13px] text-white/45">
              Ustaw cel kcal w profilu
            </p>
          )}
        </div>

        <div className="mt-4 border-t border-white/[0.07] pt-3.5">
          <DietDayMacrosBar variant="embedded" {...dayMacros} />
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
