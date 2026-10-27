"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Beef,
  Check,
  ChevronDown,
  Clock,
  Droplets,
  Flame,
  Info,
  Minus,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";
import { Meter } from "@/components/progress/progress-ui";
import { DayTypeChip } from "@/components/nutrition/day-type-chip";
import {
  formatPlNumber,
  plOdchylenia,
  type DayCardViewModel,
  type MacroBalance,
  type MacroKey,
} from "@/lib/nutrition-day-balance";
import { cn } from "@/lib/utils";

const MACRO_ICON: Record<MacroKey, LucideIcon> = {
  calories: Flame,
  protein: Beef,
  carbs: Wheat,
  fat: Droplets,
};

function DayStatusChip({ day }: { day: DayCardViewModel }) {
  switch (day.status) {
    case "in_range":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--gym-trend-up)_45%,transparent)] bg-[color-mix(in_srgb,var(--gym-trend-up)_12%,transparent)] px-2.5 py-1 text-[11px] font-medium text-[var(--gym-trend-up)]">
          <Check className="h-3 w-3" aria-hidden />
          W normie
        </span>
      );
    case "deviations":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--gym-border-gold)] bg-black/25 px-2.5 py-1 text-[11px] font-medium tabular-nums text-white/90">
          {plOdchylenia(day.highlightsCount)}
        </span>
      );
    case "empty":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--gym-text-secondary)]/50 px-2.5 py-1 text-[11px] text-[var(--gym-text-secondary)]">
          <Minus className="h-3 w-3" aria-hidden />
          Brak wpisów
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--gym-border-gold)] px-2.5 py-1 text-[11px] text-[var(--gym-text-secondary)]">
          <Info className="h-3 w-3" aria-hidden />
          Niepełne dane
        </span>
      );
    case "no_goal":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--gym-text-secondary)]/50 px-2.5 py-1 text-[11px] text-[var(--gym-text-secondary)]">
          <Minus className="h-3 w-3" aria-hidden />
          Brak celu
        </span>
      );
    case "in_progress":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--gym-gold)_35%,transparent)] px-2.5 py-1 text-[11px] text-[var(--gym-gold)]">
          <Clock className="h-3 w-3" aria-hidden />
          Dzień w toku
        </span>
      );
  }
}

function MiniMacro({ macro }: { macro: MacroBalance }) {
  const pct = macro.adherencePct;
  const over = pct != null && pct > 100;
  const under = macro.direction === "under";
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
        {macro.key === "calories"
          ? "KCAL"
          : macro.key === "protein"
            ? "BIAŁKO"
            : macro.key === "carbs"
              ? "WĘGLE"
              : "TŁUSZCZ"}
      </p>
      <p className="mt-0.5 flex items-center gap-0.5 text-[13px] font-semibold tabular-nums text-white/90">
        {pct != null ? `${pct}%` : "—"}
        {over ? (
          <ArrowUpRight className="h-3 w-3 text-white/90" aria-hidden />
        ) : under ? (
          <ArrowDownRight className="h-3 w-3 text-[var(--gym-gold)]" aria-hidden />
        ) : null}
      </p>
      <div className="mt-1">
        <Meter
          size="sm"
          pct={pct ?? 0}
          overflow={over}
          none={macro.goal == null}
        />
      </div>
    </div>
  );
}

function ExpandedRow({
  macro,
  dayType,
}: {
  macro: MacroBalance;
  dayType: DayCardViewModel["dayType"];
}) {
  const Icon = MACRO_ICON[macro.key];
  const over = macro.direction === "over";
  const under = macro.direction === "under";
  const statusText =
    macro.goal == null
      ? "brak celu"
      : over
        ? `ponad cel +${formatPlNumber(Math.abs(Math.round(macro.delta ?? 0)))} ${macro.unit}`
        : under
          ? `brakuje ${formatPlNumber(Math.abs(Math.round(macro.delta ?? 0)))} ${macro.unit}`
          : "W normie";

  return (
    <div className="space-y-1.5 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-white">{macro.label}</p>
            <p className="text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
              {formatPlNumber(macro.consumed)}
              {macro.goal != null
                ? ` z ${formatPlNumber(macro.goal)} ${macro.unit}`
                : ` ${macro.unit}`}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "inline-flex items-center gap-0.5 text-[13px]",
              over && "text-white/90",
              under && "text-[var(--gym-gold)]",
              !over && !under && macro.goal != null && "text-[var(--gym-trend-up)]",
              macro.goal == null && "text-[var(--gym-text-secondary)]",
            )}
          >
            {over ? (
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            ) : under ? (
              <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
            ) : macro.goal != null ? (
              <Check className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Minus className="h-3.5 w-3.5" aria-hidden />
            )}
            {statusText}
            {over && dayType === "training" && macro.key === "carbs"
              ? " · dzień treningowy"
              : ""}
          </p>
          {macro.adherencePct != null ? (
            <p className="mt-0.5 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
              {macro.adherencePct}%
            </p>
          ) : null}
        </div>
      </div>
      <Meter
        size="md"
        pct={macro.adherencePct ?? 0}
        overflow={over}
        none={macro.goal == null}
      />
      {macro.isPartial ? (
        <p className="text-[12px] text-[var(--gym-text-secondary)]">
          Część produktów nie ma wartości {macro.label.toLowerCase()}. Wynik może
          być zaniżony.
        </p>
      ) : null}
    </div>
  );
}

export function DayBalanceCard({
  day,
  expanded,
  onToggle,
  filterKey,
}: {
  day: DayCardViewModel;
  expanded: boolean;
  onToggle: () => void;
  filterKey?: MacroKey | "all";
}) {
  const panelId = useId();
  const macrosForExpand =
    filterKey && filterKey !== "all"
      ? day.macros.filter((m) => m.key === filterKey)
      : day.macros;

  return (
    <div className="app-card overflow-hidden p-0">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full min-h-16 flex-col gap-2.5 p-4 text-left"
        aria-label={`${day.weekdayLabel}, ${day.shortDateLabel}, ${day.status === "deviations" ? plOdchylenia(day.highlightsCount) : day.status === "empty" ? "brak wpisów" : day.status === "in_range" ? "w normie" : "status dnia"}, ${expanded ? "zwiń" : "rozwiń"}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-white">
              {day.weekdayLabel}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--gym-text-secondary)]">
              <span>{day.shortDateLabel}</span>
              <span aria-hidden>·</span>
              <DayTypeChip dayType={day.dayType} />
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <DayStatusChip day={day} />
            <ChevronDown
              className={cn(
                "h-4 w-4 text-[var(--gym-text-secondary)] transition-transform duration-200 motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
              aria-hidden
            />
          </div>
        </div>
        {day.status === "empty" ? null : (
          <div className="grid grid-cols-4 gap-2">
            {day.macros.map((m) => (
              <MiniMacro key={m.key} macro={m} />
            ))}
          </div>
        )}
      </button>
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-white/10 px-4 pb-4 pt-3">
            {day.status === "empty" ? (
              <p className="text-[13px] text-[var(--gym-text-secondary)]">
                Nie zapisano posiłków tego dnia. Dzień nie wchodzi do sumy
                tygodnia.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {macrosForExpand.map((m) => (
                  <ExpandedRow key={m.key} macro={m} dayType={day.dayType} />
                ))}
              </div>
            )}
            {day.state !== "in_progress" && day.state !== "no_entries" ? (
              <p className="mt-3 text-[11px] text-[var(--gym-text-secondary)]">
                Cel wg aktualnego planu żywieniowego.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
