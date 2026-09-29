"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus } from "lucide-react";
import { DietRecipeGrid } from "@/components/meal-suggestions/diet-recipe-grid";
import type { CatalogMeal } from "@/lib/meal-catalog-types";
import type { MealLogDto } from "@/lib/meal-logs";
import type { MealTemplate } from "@/lib/meal-templates";
import type { DietDiarySlot } from "@/lib/diet-diary-slots";
import {
  buildMealPlanRows,
  formatMealMacroLine,
  type MealPlanRow,
} from "@/lib/diet-recipe-match";
import { cn } from "@/lib/utils";

function GoalsCard({
  proteinGoal,
  carbsGoal,
  fatGoal,
  caloriesGoal,
}: {
  proteinGoal: number | null;
  carbsGoal: number | null;
  fatGoal: number | null;
  caloriesGoal: number | null;
}) {
  const cells = [
    { label: "Białko", value: proteinGoal, unit: "g" },
    { label: "Węgle", value: carbsGoal, unit: "g" },
    { label: "Tłuszcz", value: fatGoal, unit: "g" },
    { label: "Kalorie", value: caloriesGoal, unit: "kcal" },
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-[#161616] p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3 text-center"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
              {c.label}
            </p>
            <p className="mt-1 font-display text-2xl tabular-nums text-[var(--gym-gold)]">
              {c.value != null ? Math.round(c.value) : "—"}
            </p>
            <p className="text-[10px] text-white/40">{c.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DietMealPlanPanel({
  mealTemplates,
  catalogMeals,
  dateKey,
  dayMacros,
  bySlot,
  onAddManual,
  onEditLog,
  onDeleted,
  DeleteMealButton,
}: {
  mealTemplates: MealTemplate[];
  catalogMeals: CatalogMeal[];
  dateKey: string;
  dayMacros: {
    proteinGoal: number | null;
    carbsGoal: number | null;
    fatGoal: number | null;
    caloriesGoal: number | null;
  };
  bySlot: Record<DietDiarySlot, MealLogDto[]>;
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
    () => buildMealPlanRows(mealTemplates, dayMacros),
    [mealTemplates, dayMacros],
  );
  const [activeId, setActiveId] = useState<string | null>(rows[0]?.id ?? null);
  const [logsOpen, setLogsOpen] = useState<Record<string, boolean>>({});

  const activeRow: MealPlanRow | null =
    rows.find((r) => r.id === activeId) ?? rows[0] ?? null;

  return (
    <div className="space-y-4">
      <header className="px-0.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--gym-gold)]">
          Dieta
        </p>
        <h2 className="mt-1 text-[28px] font-semibold leading-tight text-white">
          Twój plan{" "}
          <span className="text-[var(--gym-gold)]">żywieniowy</span>
        </h2>
      </header>

      <GoalsCard {...dayMacros} />

      <section className="rounded-2xl border border-white/10 bg-[#161616] p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
            Rozkład posiłków
          </p>
        </div>
        <p className="mt-2 px-1 text-sm text-[var(--gym-gold)]/90">
          Stuknij posiłek, żeby zobaczyć{" "}
          <span className="font-semibold">dopasowane dania</span>.
        </p>

        <ul className="mt-3 divide-y divide-white/[0.06]">
          {rows.map((row) => {
            const selected = activeRow?.id === row.id;
            const items = bySlot[row.diarySlot] ?? [];
            const showLogs = logsOpen[row.id] ?? false;
            return (
              <li key={row.id}>
                <div className="flex items-center gap-1 py-1">
                  <button
                    type="button"
                    onClick={() => setActiveId(row.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-1 py-2.5 text-left"
                  >
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        selected
                          ? "bg-[var(--gym-gold)] text-black"
                          : "border border-white/15 text-white/55",
                      )}
                    >
                      {row.index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-white">
                        {row.label}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-white/45">
                        {formatMealMacroLine(row)}
                      </p>
                    </div>
                    {selected ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Dodaj produkt do ${row.label}`}
                    onClick={() => onAddManual(row.diarySlot)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--gym-gold)]"
                  >
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>

                {items.length > 0 ? (
                  <div className="px-1 pb-2">
                    <button
                      type="button"
                      onClick={() =>
                        setLogsOpen((prev) => ({
                          ...prev,
                          [row.id]: !showLogs,
                        }))
                      }
                      className="text-[11px] font-medium text-white/40"
                    >
                      {showLogs
                        ? "Ukryj wpisy"
                        : `Zjedzone (${items.length})`}
                    </button>
                    {showLogs ? (
                      <ul className="mt-1 space-y-1">
                        {items.map((e) => (
                          <li
                            key={e.id}
                            className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-white/85">
                                {e.name?.trim() || "Posiłek"}
                              </p>
                              <p className="text-[11px] tabular-nums text-white/40">
                                {Math.round(e.calories)} kcal · B
                                {Math.round(e.proteinG)} W{Math.round(e.carbsG)}{" "}
                                T{Math.round(e.fatG)}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-label="Edytuj"
                              onClick={() => onEditLog(e)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/40"
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
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {activeRow ? (
        <DietRecipeGrid
          key={activeRow.id}
          meals={catalogMeals}
          row={activeRow}
          dateKey={dateKey}
        />
      ) : null}
    </div>
  );
}
