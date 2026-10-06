"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowLeft,
  Beef,
  Droplets,
  Flame,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import type { PreviousWeekNutritionSheetWeek } from "@/lib/nutrition-dashboard";
import {
  buildDaysMacroBalance,
  buildPeriodMacroBalance,
  collectDayHighlights,
  dayRelativeLabel,
  formatSignedAmount,
  formatSignedPct,
  highlightVerb,
  type DayMacroBalance,
  type MacroBalance,
} from "@/lib/nutrition-day-balance";
import { cn } from "@/lib/utils";

const MACRO_ICON: Record<MacroBalance["key"], LucideIcon> = {
  calories: Flame,
  protein: Beef,
  carbs: Wheat,
  fat: Droplets,
};

const MACRO_BAR: Record<MacroBalance["key"], string> = {
  calories: "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400",
  protein: "bg-gradient-to-r from-sky-400 to-cyan-300",
  carbs: "bg-gradient-to-r from-violet-400 to-fuchsia-300",
  fat: "bg-gradient-to-r from-amber-300 to-yellow-200",
};

function statusTone(status: MacroBalance["status"]): string {
  switch (status) {
    case "deficit":
      return "text-sky-300";
    case "surplus":
      return "text-rose-300";
    case "on_track":
      return "text-emerald-300";
    default:
      return "text-white/40";
  }
}

function statusChip(status: MacroBalance["status"]): string {
  switch (status) {
    case "deficit":
      return "border-sky-400/35 bg-sky-400/15 text-sky-200";
    case "surplus":
      return "border-rose-400/35 bg-rose-400/15 text-rose-200";
    case "on_track":
      return "border-emerald-400/35 bg-emerald-400/15 text-emerald-200";
    default:
      return "border-white/12 bg-white/[0.04] text-white/45";
  }
}

function MacroStatRow({ macro }: { macro: MacroBalance }) {
  const Icon = MACRO_ICON[macro.key];
  const pct = macro.adherencePct;
  const width = pct == null ? 0 : Math.min(100, pct);
  const over = pct != null && pct > 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-[var(--gym-gold)]">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white/90">{macro.label}</p>
            <p className="text-[11px] tabular-nums text-white/45">
              {Math.round(macro.consumed)}
              {macro.goal != null ? ` / ${Math.round(macro.goal)}` : ""}{" "}
              {macro.unit}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p
            className={cn(
              "text-[13px] font-semibold tabular-nums",
              statusTone(macro.status),
            )}
          >
            {macro.delta == null
              ? "—"
              : formatSignedAmount(macro.delta, macro.unit)}
          </p>
          <p
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              statusTone(macro.status),
            )}
          >
            {pct != null ? `${pct}%` : "—"}
            {macro.deltaPct != null ? (
              <span className="text-white/35">
                {" "}
                · {formatSignedPct(macro.deltaPct)}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            over ? "bg-rose-400" : MACRO_BAR[macro.key],
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function DayCard({
  day,
  todayKey,
  emphasize,
}: {
  day: DayMacroBalance;
  todayKey: string;
  emphasize?: boolean;
}) {
  const label = dayRelativeLabel(day, todayKey);
  return (
    <section
      className={cn(
        "app-card space-y-4 p-4",
        emphasize && "ring-1 ring-[var(--gym-gold)]/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            {label}
          </p>
          <h2 className="mt-1 text-[16px] font-semibold text-white">
            {day.headline}
          </h2>
        </div>
        {!day.hasFood ? (
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/45">
            Brak wpisów
          </span>
        ) : day.highlights.length === 0 ? (
          <span className="rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
            W normie
          </span>
        ) : (
          <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] tabular-nums text-white/55">
            {day.highlights.length} odchyl.
          </span>
        )}
      </div>
      <div className="space-y-3.5">
        {day.macros.map((m) => (
          <MacroStatRow key={m.key} macro={m} />
        ))}
      </div>
    </section>
  );
}

function HighlightList({
  days,
  todayKey,
}: {
  days: DayMacroBalance[];
  todayKey: string;
}) {
  const items = useMemo(() => collectDayHighlights(days), [days]);

  if (!items.length) {
    return (
      <section className="app-card p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          Braki i nadwyżki
        </p>
        <p className="mt-2 text-[14px] text-white/70">
          Od poniedziałku do dziś makro są w normie albo brak jeszcze wpisów.
        </p>
      </section>
    );
  }

  return (
    <section className="app-card space-y-3 p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          Braki i nadwyżki
        </p>
        <p className="mt-1 text-[13px] text-white/50">
          Pn→dziś · gramatura i odchylenie od celu w %
        </p>
      </div>
      <ul className="space-y-2">
        {items.map(({ day, macro }) => {
          const absDelta =
            macro.delta == null ? null : Math.abs(Math.round(macro.delta));
          return (
            <li
              key={`${day.dateKey}-${macro.key}`}
              className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-white/85">
                  {dayRelativeLabel(day, todayKey)}
                  <span className="text-white/35"> · </span>
                  {macro.label}
                </p>
                <p className="mt-0.5 text-[12px] text-white/50">
                  {highlightVerb(macro.status)}
                  {absDelta != null ? ` ${absDelta} ${macro.unit}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    statusChip(macro.status),
                  )}
                >
                  {formatSignedAmount(macro.delta, macro.unit)}
                </span>
                <p
                  className={cn(
                    "mt-1 text-[12px] font-semibold tabular-nums",
                    statusTone(macro.status),
                  )}
                >
                  {macro.adherencePct != null ? `${macro.adherencePct}%` : "—"}
                  <span className="font-normal text-white/35">
                    {" "}
                    ({formatSignedPct(macro.deltaPct)})
                  </span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function NutritionTodayView({
  todayKey,
  currentWeek,
}: {
  todayKey: string;
  currentWeek: PreviousWeekNutritionSheetWeek | null;
}) {
  const dayRows = currentWeek?.dayRows ?? [];
  const days = useMemo(
    () => buildDaysMacroBalance(dayRows, todayKey),
    [dayRows, todayKey],
  );
  const period = useMemo(
    () => buildPeriodMacroBalance(dayRows, todayKey),
    [dayRows, todayKey],
  );
  const today = days.find((d) => d.isToday) ?? null;
  const earlier = [...days].filter((d) => !d.isToday).reverse();

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-10">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80 hover:bg-white/[0.08]"
          aria-label="Wróć na Pulpit"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Makro dziś
          </p>
          <h1 className="truncate text-[18px] font-semibold text-white sm:text-[20px]">
            Statystyki bilansu
          </h1>
          <p className="text-[11px] text-white/40">
            {currentWeek?.weekLabel ?? "Bieżący tydzień"} · pn→dziś
          </p>
        </div>
        <Link
          href="/nutrition/week"
          className="shrink-0 text-[12px] font-medium text-[var(--gym-gold)]/85 hover:text-[var(--gym-gold)]"
        >
          Tydzień →
        </Link>
      </div>

      <HighlightList days={days} todayKey={todayKey} />

      {today ? (
        <DayCard day={today} todayKey={todayKey} emphasize />
      ) : (
        <section className="app-card p-4 text-[14px] text-white/55">
          Brak danych na dziś.
        </section>
      )}

      <section className="app-card space-y-4 p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            Suma pn→dziś
          </p>
          <p className="mt-1 text-[13px] text-white/50">
            Łączne spożycie vs suma celów · {period.daysCounted}{" "}
            {period.daysCounted === 1 ? "dzień" : "dni"} z danymi
          </p>
        </div>
        <div className="space-y-3.5">
          {period.macros.map((m) => (
            <MacroStatRow key={m.key} macro={m} />
          ))}
        </div>
      </section>

      {earlier.length > 0 ? (
        <div className="space-y-3">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Poprzednie dni tygodnia
          </p>
          {earlier.map((day) => (
            <DayCard key={day.dateKey} day={day} todayKey={todayKey} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
