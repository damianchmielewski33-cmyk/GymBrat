"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { AppPageHeader } from "@/components/layout/screen";
import { SectionLabel } from "@/components/ui/section-label";
import { EmptyNote, Explainer } from "@/components/progress/progress-ui";
import { MacroMeter } from "@/components/nutrition/macro-meter";
import { WeekTrendBars } from "@/components/nutrition/week-trend-bars";
import {
  MacroFilterChips,
  type MacroFilter,
} from "@/components/nutrition/macro-filter-chips";
import { DayBalanceCard } from "@/components/nutrition/day-balance-card";
import type { PreviousWeekNutritionSheetWeek } from "@/lib/nutrition-dashboard";
import {
  buildMacroBalanceViewModel,
  formatPlNumber,
  type DayCardViewModel,
  type MacroBalance,
  type MacroKey,
} from "@/lib/nutrition-day-balance";
import {
  adherenceDeltaPp,
  adherencePct,
  avgWeeksAdherencePct,
  formatSignedPp,
  rollupWeekThroughIndex,
  weekDayIndexThroughToday,
  type WeekMacroRollup,
} from "@/lib/nutrition-week-stats";
import { cn } from "@/lib/utils";

function WeekNavButton({
  direction,
  disabled,
  label,
  onClick,
}: {
  direction: "prev" | "next";
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--gym-border-gold)] bg-black/25 text-white/90 transition",
        disabled
          ? "cursor-not-allowed opacity-35"
          : "hover:bg-white/[0.08]",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function deltaClass(delta: number | null): string {
  if (delta == null || Math.round(delta) === 0) {
    return "text-[var(--gym-text-secondary)]";
  }
  // Bez czerwieni oceniającej (jak MAKRO DZIŚ): plus = złoto, minus = secondary.
  return delta > 0 ? "text-[var(--gym-gold)]" : "text-[var(--gym-text-secondary)]";
}

function WeekCompareCard({
  weekToDateRollup,
  compareWeek,
  compareRollup,
  compareIndex,
  maxCompareIndex,
  minCompareIndex,
  onCompareIndexChange,
  throughDayIndex,
  avgSourceWeeks,
  periodHint,
}: {
  weekToDateRollup: WeekMacroRollup;
  compareWeek: PreviousWeekNutritionSheetWeek | null;
  compareRollup: WeekMacroRollup | null;
  compareIndex: number;
  maxCompareIndex: number;
  minCompareIndex: number;
  onCompareIndexChange: (index: number) => void;
  throughDayIndex: number;
  avgSourceWeeks: PreviousWeekNutritionSheetWeek[];
  periodHint: string;
}) {
  const thisPct = adherencePct(
    weekToDateRollup.calories.consumed,
    weekToDateRollup.calories.goal,
  );
  const comparePct = compareRollup
    ? adherencePct(
        compareRollup.calories.consumed,
        compareRollup.calories.goal,
      )
    : null;
  const vsCompare = adherenceDeltaPp(thisPct, comparePct);

  const avgPrev = avgWeeksAdherencePct(
    avgSourceWeeks.map((w) => w.dayRows),
    throughDayIndex,
    "calories",
  );
  const vsAvg = adherenceDeltaPp(thisPct, avgPrev);
  const avgWeekCount = avgSourceWeeks.filter((w) => {
    const t = rollupWeekThroughIndex(w.dayRows, throughDayIndex).calories;
    return adherencePct(t.consumed, t.goal) != null;
  }).length;

  const macros: { key: MacroKey; label: string }[] = [
    { key: "calories", label: "Kcal" },
    { key: "protein", label: "Białko" },
    { key: "carbs", label: "Węgle" },
    { key: "fat", label: "Tłuszcz" },
  ];

  if (!compareWeek && avgSourceWeeks.length === 0) return null;

  return (
    <section className="app-card space-y-3.5 p-4 sm:p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
          Porównanie tygodni
        </p>
        <p className="mt-1 text-[13px] text-[var(--gym-text-secondary)]">
          {periodHint}
        </p>
      </div>

      {compareWeek ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 px-2 py-2">
          <WeekNavButton
            direction="prev"
            disabled={compareIndex >= maxCompareIndex}
            label="Starszy tydzień do porównania"
            onClick={() =>
              onCompareIndexChange(Math.min(maxCompareIndex, compareIndex + 1))
            }
          />
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--gym-text-secondary)]">
              Porównaj z
            </p>
            <p className="truncate text-[13px] font-semibold text-white">
              {compareWeek.weekLabel}
            </p>
          </div>
          <WeekNavButton
            direction="next"
            disabled={compareIndex <= minCompareIndex}
            label="Nowszy tydzień do porównania"
            onClick={() =>
              onCompareIndexChange(Math.max(minCompareIndex, compareIndex - 1))
            }
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--gym-text-secondary)]">
            Vs wybrany
          </p>
          <p
            className={cn(
              "mt-1 font-metric text-[26px] leading-none tabular-nums",
              deltaClass(vsCompare),
            )}
          >
            {formatSignedPp(vsCompare) ?? "—"}
          </p>
          <p className="mt-1.5 text-[11px] tabular-nums text-[var(--gym-text-secondary)]">
            ten {thisPct != null ? `${thisPct}%` : "—"} · wybr.{" "}
            {comparePct != null ? `${comparePct}%` : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--gym-text-secondary)]">
            Vs średnia {avgWeekCount || "—"} tyg.
          </p>
          <p
            className={cn(
              "mt-1 font-metric text-[26px] leading-none tabular-nums",
              deltaClass(vsAvg),
            )}
          >
            {formatSignedPp(vsAvg) ?? "—"}
          </p>
          <p className="mt-1.5 text-[11px] tabular-nums text-[var(--gym-text-secondary)]">
            średnia {avgPrev != null ? `${avgPrev}%` : "—"}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.08]">
        <div className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-px bg-white/[0.06] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--gym-text-secondary)]">
          <div className="bg-[#121212] px-2.5 py-2">Makro</div>
          <div className="bg-[#121212] px-2 py-2 text-center">Ten</div>
          <div className="bg-[#121212] px-2 py-2 text-center">Wybr.</div>
          <div className="bg-[#121212] px-2 py-2 text-center">Δ pp</div>
        </div>
        {macros.map(({ key, label }) => {
          const cur = weekToDateRollup[key];
          const prev = compareRollup ? compareRollup[key] : null;
          const curP = adherencePct(cur.consumed, cur.goal);
          const prevP = prev ? adherencePct(prev.consumed, prev.goal) : null;
          const d = adherenceDeltaPp(curP, prevP);
          return (
            <div
              key={key}
              className="grid grid-cols-[1fr_repeat(3,minmax(0,1fr))] gap-px bg-white/[0.06] text-[12px] tabular-nums"
            >
              <div className="bg-[#0e0e0e] px-2.5 py-2.5 font-medium text-white/85">
                {label}
              </div>
              <div className="bg-[#0e0e0e] px-2 py-2.5 text-center text-white/80">
                {curP != null ? `${curP}%` : "—"}
              </div>
              <div className="bg-[#0e0e0e] px-2 py-2.5 text-center text-[var(--gym-text-secondary)]">
                {prevP != null ? `${prevP}%` : "—"}
              </div>
              <div
                className={cn(
                  "bg-[#0e0e0e] px-2 py-2.5 text-center font-semibold",
                  deltaClass(d),
                )}
              >
                {formatSignedPp(d) ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function heroKcal(macros: MacroBalance[]): MacroBalance | null {
  return macros.find((m) => m.key === "calories") ?? null;
}

export function NutritionWeekView({
  todayKey,
  weeks,
}: {
  todayKey: string;
  /** Najnowszy pierwszy: [bieżący, -1 tyg., …]. */
  weeks: PreviousWeekNutritionSheetWeek[];
}) {
  const [viewIndex, setViewIndex] = useState(0);
  // key resetuje filtr, porównanie i rozwiniętą kartę przy zmianie tygodnia.
  return (
    <NutritionWeekBody
      key={viewIndex}
      todayKey={todayKey}
      weeks={weeks}
      viewIndex={viewIndex}
      setViewIndex={setViewIndex}
    />
  );
}

function NutritionWeekBody({
  todayKey,
  weeks,
  viewIndex,
  setViewIndex,
}: {
  todayKey: string;
  weeks: PreviousWeekNutritionSheetWeek[];
  viewIndex: number;
  setViewIndex: (update: (i: number) => number) => void;
}) {
  const maxViewIndex = Math.max(0, weeks.length - 1);
  const [compareIndex, setCompareIndex] = useState(
    Math.min(viewIndex + 1, maxViewIndex),
  );
  const [filter, setFilter] = useState<MacroFilter>("all");
  // undefined = domyślnie pierwszy dzień z odchyleniami; null = wszystko zwinięte.
  const [expandedOverride, setExpandedOverride] = useState<
    string | null | undefined
  >(undefined);

  const viewWeek = weeks[viewIndex] ?? weeks[0] ?? null;
  const dayRows = useMemo(() => viewWeek?.dayRows ?? [], [viewWeek]);

  const isCurrentWeek = Boolean(
    viewWeek &&
      viewWeek.weekStart <= todayKey &&
      todayKey <= viewWeek.weekEnd,
  );

  const model = useMemo(() => {
    if (!viewWeek) return null;
    return buildMacroBalanceViewModel(
      viewWeek.dayRows,
      todayKey,
      viewWeek.weekLabel,
    );
  }, [viewWeek, todayKey]);

  const allDays: DayCardViewModel[] = useMemo(() => {
    if (!model) return [];
    const list = [
      ...(model.today ? [model.today] : []),
      ...model.pastDays,
    ];
    return list.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }, [model]);

  const expandedKey =
    expandedOverride !== undefined
      ? expandedOverride
      : (allDays.find((d) => d.status === "deviations")?.dateKey ?? null);

  const filteredDays = useMemo(() => {
    if (filter === "all") return allDays;
    return allDays.filter((d) => d.deviations.some((dev) => dev.key === filter));
  }, [filter, allDays]);

  const filterCounts = useMemo(() => {
    const counts: Record<MacroFilter, number> = {
      all: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    for (const day of allDays) {
      if (day.status !== "deviations") continue;
      counts.all += day.deviations.length;
      for (const d of day.deviations) counts[d.key] += 1;
    }
    return counts;
  }, [allDays]);

  const visibleDeviationCount = useMemo(() => {
    if (filter === "all") return filterCounts.all;
    return filteredDays.reduce(
      (n, d) => n + d.deviations.filter((x) => x.key === filter).length,
      0,
    );
  }, [filter, filteredDays, filterCounts.all]);

  const throughDayIndex = useMemo(() => {
    if (!viewWeek) return 0;
    if (isCurrentWeek) {
      return weekDayIndexThroughToday(viewWeek.dayRows, todayKey);
    }
    return Math.max(0, viewWeek.dayRows.length - 1);
  }, [viewWeek, isCurrentWeek, todayKey]);

  const weekToDateRollup = useMemo(
    () => rollupWeekThroughIndex(dayRows, throughDayIndex),
    [dayRows, throughDayIndex],
  );

  const minCompareIndex = Math.min(viewIndex + 1, maxViewIndex);
  const compareWeek =
    compareIndex > viewIndex && compareIndex < weeks.length
      ? (weeks[compareIndex] ?? null)
      : null;

  const compareRollup = useMemo(() => {
    if (!compareWeek) return null;
    return rollupWeekThroughIndex(compareWeek.dayRows, throughDayIndex);
  }, [compareWeek, throughDayIndex]);

  const avgSourceWeeks = useMemo(
    () => weeks.slice(viewIndex + 1, viewIndex + 5),
    [weeks, viewIndex],
  );

  const periodHint = isCurrentWeek
    ? "Różnica realizacji celu (pp) · pn→dziś vs ten sam okres"
    : "Różnica realizacji celu (pp) · cały tydzień vs ten sam okres";

  const kcal = model ? heroKcal(model.period.macros) : null;
  const periodLabel = isCurrentWeek ? "Tydzień PN→dziś" : "Suma tygodnia";
  const periodMeta = isCurrentWeek
    ? model?.weekRangeMeta
    : viewWeek
      ? `${viewWeek.weekLabel} · cały tydzień`
      : null;

  if (!viewWeek || !model) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-10 text-[14px] text-[var(--gym-text-secondary)] sm:px-5">
        Brak danych tygodnia.
      </div>
    );
  }

  const emptyStart = model.period.daysWithEntries === 0;
  const zeroDeviations =
    filterCounts.all === 0 && model.period.daysWithEntries > 0;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 pb-10 sm:px-5">
      <div className="flex items-start gap-2">
        <Link
          href="/nutrition/today"
          className="mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--gym-border-gold)] bg-black/25 text-white/90"
          aria-label="Wróć do bilansu dziś"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <AppPageHeader
            className="pb-0 pt-0"
            kicker="MAKRO TYDZIEŃ"
            title="Statystyki bilansu"
            description={periodMeta ?? viewWeek.weekLabel}
          />
          <div className="mt-3 flex items-center gap-2">
            <WeekNavButton
              direction="prev"
              disabled={viewIndex >= maxViewIndex}
              label="Poprzedni tydzień"
              onClick={() => setViewIndex((i) => Math.min(maxViewIndex, i + 1))}
            />
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[15px] font-semibold text-white">
                {viewWeek.weekLabel}
              </p>
              <p className="text-[12px] text-[var(--gym-text-secondary)]">
                {isCurrentWeek
                  ? "Bieżący tydzień"
                  : `Historia · ${viewIndex} tyg. wstecz`}
              </p>
            </div>
            <WeekNavButton
              direction="next"
              disabled={viewIndex <= 0}
              label="Nowszy tydzień"
              onClick={() => setViewIndex((i) => Math.max(0, i - 1))}
            />
          </div>
        </div>
      </div>

      <section aria-labelledby="macro-week-sum-heading" className="space-y-3">
        <SectionLabel index="01" title={periodLabel} titleAs="h2" />
        <div
          id="macro-week-sum-heading"
          className="app-card relative overflow-hidden space-y-4 p-4 sm:p-5"
          style={{
            boxShadow:
              "inset 0 1px 0 color-mix(in srgb, var(--gym-gold) 12%, transparent)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--gym-gold)_12%,transparent),transparent_70%)]"
            aria-hidden
          />
          {model.period.state === "no_data" ? (
            <EmptyNote>
              Tydzień zacznie się liczyć po pierwszym wpisie posiłku.
            </EmptyNote>
          ) : (
            <div className="relative space-y-4">
              <div className="space-y-1">
                <p className="text-[12px] text-[var(--gym-text-secondary)]">
                  {model.period.daysWithEntries} z {model.period.daysInWeek} dni
                  z wpisami
                  {kcal?.adherencePct != null
                    ? ` · kcal ${kcal.adherencePct}% celu`
                    : ""}
                </p>
                {kcal ? (
                  <p className="font-metric text-[32px] tabular-nums leading-none text-[var(--gym-gold)] sm:text-[36px]">
                    {formatPlNumber(kcal.consumed)}
                    {kcal.goal != null ? (
                      <span className="text-[16px] font-semibold text-white/85">
                        {" "}
                        / {formatPlNumber(kcal.goal)} kcal
                      </span>
                    ) : (
                      <span className="text-[16px] font-semibold text-white/85">
                        {" "}
                        kcal
                      </span>
                    )}
                  </p>
                ) : null}
                <Explainer label="Jak liczymy?">
                  {isCurrentWeek
                    ? "Suma obejmuje dni z co najmniej jednym wpisem. Dzisiejszy dzień jest w sumie w trakcie – odcinek jaśniejszy."
                    : "Suma obejmuje dni z co najmniej jednym wpisem w wybranym tygodniu. Cele wg aktualnego planu żywieniowego."}
                </Explainer>
              </div>
              <div className="space-y-3.5">
                {model.period.macros.map((m) => (
                  <MacroMeter
                    key={m.key}
                    macro={m}
                    showTodayNote={isCurrentWeek && m.key === "calories"}
                  />
                ))}
              </div>
              <WeekTrendBars days={model.trendDays} />
            </div>
          )}
        </div>
      </section>

      <WeekCompareCard
        weekToDateRollup={weekToDateRollup}
        compareWeek={compareWeek}
        compareRollup={compareRollup}
        compareIndex={compareIndex}
        maxCompareIndex={maxViewIndex}
        minCompareIndex={minCompareIndex}
        onCompareIndexChange={setCompareIndex}
        throughDayIndex={throughDayIndex}
        avgSourceWeeks={avgSourceWeeks}
        periodHint={periodHint}
      />

      <section className="space-y-3" aria-labelledby="macro-week-days-heading">
        <SectionLabel
          index="02"
          title="Dni tygodnia"
          titleAs="h2"
          trailing={
            !emptyStart && !zeroDeviations ? (
              <span className="tabular-nums text-[var(--gym-text-secondary)]">
                {visibleDeviationCount} odch. · {filteredDays.length}{" "}
                {filteredDays.length === 1 ? "dzień" : "dni"}
              </span>
            ) : null
          }
        />
        <div id="macro-week-days-heading" className="space-y-2.5">
          {emptyStart ? (
            <EmptyNote>
              Tu pojawią się dni tygodnia, gdy zapiszesz posiłki.
            </EmptyNote>
          ) : (
            <>
              {!zeroDeviations ? (
                <MacroFilterChips
                  value={filter}
                  counts={filterCounts}
                  onChange={setFilter}
                />
              ) : (
                <EmptyNote>
                  Brak odchyleń w dniach tego tygodnia — lista dni poniżej.
                </EmptyNote>
              )}
              <div className="grid gap-2.5 md:grid-cols-2">
                {(filter === "all" || zeroDeviations ? allDays : filteredDays).map(
                  (day) => (
                    <DayBalanceCard
                      key={day.dateKey}
                      day={day}
                      expanded={expandedKey === day.dateKey}
                      onToggle={() =>
                        setExpandedOverride(
                          expandedKey === day.dateKey ? null : day.dateKey,
                        )
                      }
                      filterKey={filter}
                    />
                  ),
                )}
              </div>
              {filter !== "all" && !zeroDeviations && filteredDays.length === 0 ? (
                <EmptyNote>
                  Brak dni z odchyleniem dla wybranego filtra.
                </EmptyNote>
              ) : null}
            </>
          )}
        </div>
      </section>

      {model.goalsAnnotation ? (
        <p className="px-1 text-[11px] text-[var(--gym-text-secondary)]">
          {model.goalsAnnotation}
        </p>
      ) : null}
    </div>
  );
}
