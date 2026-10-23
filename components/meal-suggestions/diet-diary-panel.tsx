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
import { hapticTap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const DIARY_GOLD = "#DDBB6D";
const DIARY_GOLD_RGB = "221, 187, 109";

const springSoft = { type: "spring" as const, stiffness: 380, damping: 28 };
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

  const kcalGoal = dayMacros.caloriesGoal;
  const kcalEaten = Math.round(dayMacros.caloriesConsumed);
  const kcalRemaining =
    dayMacros.caloriesRemaining != null
      ? Math.round(dayMacros.caloriesRemaining)
      : kcalGoal != null
        ? Math.round(kcalGoal - kcalEaten)
        : null;
  const kcalDelta =
    kcalGoal != null ? Math.round(kcalEaten - kcalGoal) : null;
  const overGoal = kcalDelta != null && kcalDelta > 0;
  const kcalPct =
    kcalGoal != null && kcalGoal > 0
      ? Math.min(100, Math.round((kcalEaten / kcalGoal) * 100))
      : 0;

  const [expandedSlot, setExpandedSlot] = useState<DietDiarySlot | null>(null);

  const macroRows = [
    {
      key: "B",
      label: "Białko",
      consumed: Math.round(dayMacros.proteinConsumed),
      goal: dayMacros.proteinGoal,
      color: "#F2DC95",
      kcalPerG: 4,
    },
    {
      key: "W",
      label: "Węgle",
      consumed: Math.round(dayMacros.carbsConsumed),
      goal: dayMacros.carbsGoal,
      color: "#D1A84A",
      kcalPerG: 4,
    },
    {
      key: "T",
      label: "Tłuszcze",
      consumed: Math.round(dayMacros.fatConsumed),
      goal: dayMacros.fatGoal,
      color: "#8A6A2C",
      kcalPerG: 9,
    },
  ] as const;

  // Udział makro w kcal: z zjedzonych, a gdy nic nie zjedzono — z celów dnia.
  const eatenKcalByMacro = macroRows.map((r) => r.consumed * r.kcalPerG);
  const goalKcalByMacro = macroRows.map((r) => (r.goal ?? 0) * r.kcalPerG);
  const shareBase =
    eatenKcalByMacro.reduce((a, b) => a + b, 0) > 0
      ? eatenKcalByMacro
      : goalKcalByMacro;
  const shareTotal = shareBase.reduce((a, b) => a + b, 0);
  const macroShare = shareBase.map((v) =>
    shareTotal > 0 ? Math.round((v / shareTotal) * 100) : null,
  );

  return (
    <div className="space-y-3.5">
      {/* Hero — Zjedzone */}
      <motion.section
        initial={{ opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springSoft, delay: 0.32 }}
        className="relative overflow-hidden rounded-[24px] border border-white/[0.08] px-4 py-4 sm:px-5 sm:py-5"
        style={{
          background: `
            radial-gradient(120% 90% at 50% -10%, rgba(${DIARY_GOLD_RGB}, 0.16) 0%, transparent 55%),
            radial-gradient(80% 60% at 100% 100%, rgba(${DIARY_GOLD_RGB}, 0.06) 0%, transparent 50%),
            #0A0A0A
          `,
          boxShadow: `
            0 0 0 1px rgba(${DIARY_GOLD_RGB}, 0.08),
            0 0 48px rgba(${DIARY_GOLD_RGB}, 0.07),
            inset 0 1px 0 rgba(255,255,255,0.06)
          `,
        }}
      >
        {/* Luksusowy refleks co 15s */}
        <div
          aria-hidden
          className="diary-macro-sheen pointer-events-none absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />

        <div className="relative flex items-center justify-between gap-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: DIARY_GOLD }}
          >
            Zjedzone
          </p>
          {kcalGoal != null ? (
            <p
              className={cn(
                "truncate text-[11px] tabular-nums tracking-tight",
                overGoal ? "text-rose-300/90" : "text-white/45",
              )}
            >
              {kcalRemaining != null && !overGoal
                ? `zostało ${Math.max(0, kcalRemaining)} · cel ${Math.round(kcalGoal)}`
                : `cel ${Math.round(kcalGoal)}${
                    kcalDelta != null
                      ? ` · ${kcalDelta > 0 ? "+" : ""}${kcalDelta}`
                      : ""
                  }`}
            </p>
          ) : (
            <p className="truncate text-[11px] text-white/40">
              Ustaw cel w profilu
            </p>
          )}
        </div>

        {/* Pierścień kcal + makro (B / W / T) */}
        <div className="relative mt-4 flex items-center gap-4 sm:gap-6">
          <div className="relative h-[116px] w-[116px] shrink-0 sm:h-[132px] sm:w-[132px]">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <defs>
                <linearGradient id="diary-ring-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F5E4A3" />
                  <stop offset="55%" stopColor="#DDBB6D" />
                  <stop offset="100%" stopColor="#B88A32" />
                </linearGradient>
              </defs>
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="9"
              />
              <motion.circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke={overGoal ? "#FB7185" : "url(#diary-ring-gold)"}
                strokeWidth="9"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: kcalPct / 100 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                style={{
                  filter: `drop-shadow(0 0 6px rgba(${DIARY_GOLD_RGB}, 0.35))`,
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center font-metric tabular-nums">
              <p
                className={cn(
                  "text-[clamp(1.6rem,6.5vw,2.1rem)] font-semibold leading-none tracking-tight",
                  overGoal ? "text-rose-300" : "text-[#F4EEDD]",
                )}
              >
                <AnimatedMetric
                  value={kcalEaten}
                  durationMs={700}
                  className="text-[clamp(1.6rem,6.5vw,2.1rem)] leading-none"
                />
              </p>
              <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white/45">
                kcal
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-3 font-metric tabular-nums">
            {macroRows.map((row) => {
              const pct =
                row.goal != null && row.goal > 0
                  ? Math.min(100, (row.consumed / row.goal) * 100)
                  : 0;
              const over = row.goal != null && row.consumed > row.goal;
              return (
                <div key={row.key}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className="flex min-w-0 items-center gap-2 truncate text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: DIARY_GOLD }}
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      {row.label}
                    </p>
                    <p
                      className={cn(
                        "shrink-0 text-[17px] font-semibold leading-none sm:text-[19px]",
                        over ? "text-rose-300" : "text-white",
                      )}
                    >
                      <AnimatedMetric
                        value={row.consumed}
                        durationMs={700}
                        className="text-[17px] leading-none sm:text-[19px]"
                      />
                      {row.goal != null ? (
                        <span className="text-[11px] font-medium text-white/35">
                          {" "}
                          / {Math.round(row.goal)}
                        </span>
                      ) : null}
                      <span className="ml-1 text-[11px] font-medium text-white/40">
                        g
                      </span>
                    </p>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: over ? "#FB7185" : row.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{
                        duration: 0.7,
                        ease: [0.22, 1, 0.36, 1],
                        delay: 0.45,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Udział makro w kaloriach */}
        <div className="relative mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3 text-[11px] tabular-nums text-white/45">
          {macroRows.map((row, i) => (
            <p
              key={row.key}
              className={cn(
                "truncate",
                i === 1 && "text-center",
                i === 2 && "text-right",
              )}
            >
              {row.label}{" "}
              <span className="font-semibold text-white/85">
                {macroShare[i] != null ? `${macroShare[i]}%` : "—"}
              </span>
            </p>
          ))}
        </div>
      </motion.section>

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
