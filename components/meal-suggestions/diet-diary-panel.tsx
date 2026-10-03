"use client";

import { BookOpen, Pencil, Plus, ScanBarcode } from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import {
  DIET_DIARY_SLOT_LABELS,
  DIET_DIARY_SLOTS,
  type DietDiarySlot,
} from "@/lib/diet-diary-slots";
import type { MealLogDto } from "@/lib/meal-logs";
import { cn } from "@/lib/utils";

function MacroProgress({
  label,
  consumed,
  goal,
  barClass,
}: {
  label: string;
  consumed: number;
  goal: number | null;
  barClass: string;
}) {
  const pct =
    goal != null && goal > 0
      ? Math.min(100, Math.round((consumed / goal) * 100))
      : 0;
  const over = goal != null && consumed > goal;
  const remaining =
    goal != null && goal > 0 ? Math.round(goal - consumed) : null;

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            over ? "bg-rose-400" : barClass,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
        {label}
      </p>
      <p className="mt-0.5 text-[12px] tabular-nums text-white/85">
        {Math.round(consumed)}
        {goal != null ? ` / ${Math.round(goal)}` : ""} g
      </p>
      {remaining != null ? (
        <p
          className={cn(
            "mt-0.5 text-[10px] tabular-nums",
            over ? "text-rose-300" : "text-white/40",
          )}
        >
          {over ? `+${Math.abs(remaining)}` : `${remaining} zostało`}
        </p>
      ) : null}
    </div>
  );
}

function SlotTotals({ entries }: { entries: MealLogDto[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-white/35">Brak wpisów</p>;
  }
  const kcal = entries.reduce((s, e) => s + e.calories, 0);
  const p = entries.reduce((s, e) => s + e.proteinG, 0);
  const c = entries.reduce((s, e) => s + e.carbsG, 0);
  const f = entries.reduce((s, e) => s + e.fatG, 0);
  return (
    <p className="text-xs tabular-nums text-white/45">
      {Math.round(kcal)} kcal · {Math.round(p)}B · {Math.round(c)}W ·{" "}
      {Math.round(f)}T
    </p>
  );
}

export function DietDiaryPanel({
  bySlot,
  dayMacros,
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
  const kcalLeft = dayMacros.caloriesRemaining;
  const overGoal =
    dayMacros.caloriesGoal != null &&
    dayMacros.caloriesConsumed > dayMacros.caloriesGoal;

  return (
    <div className="space-y-4">
      <header className="space-y-3 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          Dziennik
        </p>
        <div className="flex items-end gap-2">
          <AnimatedMetric
            value={Math.round(dayMacros.caloriesConsumed)}
            className="text-[52px] leading-none text-white"
          />
          <span className="mb-2 text-sm font-medium text-white/45">kcal</span>
        </div>
        {dayMacros.caloriesGoal != null ? (
          <p
            className={cn(
              "text-sm tabular-nums",
              overGoal ? "text-rose-300" : "text-white/55",
            )}
          >
            {overGoal
              ? `+${Math.round(dayMacros.caloriesConsumed - dayMacros.caloriesGoal)} kcal nad celem`
              : kcalLeft != null
                ? `${kcalLeft} kcal zostało (cel ${Math.round(dayMacros.caloriesGoal)})`
                : `Cel ${Math.round(dayMacros.caloriesGoal)} kcal`}
          </p>
        ) : (
          <p className="text-sm text-white/45">Ustaw cel kcal w profilu</p>
        )}

        <div className="flex gap-3 rounded-2xl border border-white/10 bg-[#161616] px-3 py-3">
          <MacroProgress
            label="Białko"
            consumed={dayMacros.proteinConsumed}
            goal={dayMacros.proteinGoal}
            barClass="bg-sky-400"
          />
          <MacroProgress
            label="Węgle"
            consumed={dayMacros.carbsConsumed}
            goal={dayMacros.carbsGoal}
            barClass="bg-violet-400"
          />
          <MacroProgress
            label="Tłuszcz"
            consumed={dayMacros.fatConsumed}
            goal={dayMacros.fatGoal}
            barClass="bg-amber-400"
          />
        </div>
      </header>

      <button
        type="button"
        onClick={() => onScan(defaultScanSlot)}
        className="gold-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold"
      >
        <ScanBarcode className="h-5 w-5" />
        Skanuj kod kreskowy
      </button>

      <div className="space-y-2.5">
        {DIET_DIARY_SLOTS.map((slot) => {
          const items = bySlot[slot] ?? [];
          return (
            <section key={slot} className="app-card overflow-hidden">
              <div className="flex items-center gap-2 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-white">
                    {DIET_DIARY_SLOT_LABELS[slot]}
                  </h3>
                  <SlotTotals entries={items} />
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Skanuj do ${DIET_DIARY_SLOT_LABELS[slot]}`}
                    onClick={() => onScan(slot)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--gym-gold)] hover:bg-white/[0.06]"
                  >
                    <ScanBarcode className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Przepisy do ${DIET_DIARY_SLOT_LABELS[slot]}`}
                    onClick={() => onOpenCatalog(slot)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--gym-gold)] hover:bg-white/[0.06]"
                  >
                    <BookOpen className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Dodaj ręcznie do ${DIET_DIARY_SLOT_LABELS[slot]}`}
                    onClick={() => onAddManual(slot)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--gym-gold)] hover:bg-white/[0.06]"
                  >
                    <Plus className="h-5 w-5" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {items.length > 0 ? (
                <ul className="divide-y divide-white/[0.05] border-t border-white/[0.06]">
                  {items.map((e) => (
                    <li
                      key={e.id}
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
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
