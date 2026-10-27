"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppPageHeader } from "@/components/layout/screen";
import { SectionLabel } from "@/components/ui/section-label";
import { EmptyNote, Explainer } from "@/components/progress/progress-ui";
import { cn } from "@/lib/utils";
import { DayTypeChip } from "@/components/nutrition/day-type-chip";
import { MacroTodayTile } from "@/components/nutrition/macro-today-tile";
import { MacroMeter } from "@/components/nutrition/macro-meter";
import { WeekTrendBars } from "@/components/nutrition/week-trend-bars";
import {
  MacroFilterChips,
  type MacroFilter,
} from "@/components/nutrition/macro-filter-chips";
import { DayBalanceCard } from "@/components/nutrition/day-balance-card";
import {
  formatPlNumber,
  type MacroBalanceViewModel,
  type MacroKey,
} from "@/lib/nutrition-day-balance";

function overMacroNames(model: MacroBalanceViewModel): string {
  const today = model.today;
  if (!today) return "";
  const overs = today.macros
    .filter((m) => m.direction === "over")
    .map((m) =>
      m.key === "calories"
        ? "kalorie"
        : m.key === "protein"
          ? "białko"
          : m.key === "carbs"
            ? "węgle"
            : "tłuszcz",
    );
  if (!overs.length) return "";
  if (overs.length === 1) return overs[0]!;
  if (overs.length === 2) return `${overs[0]} i ${overs[1]}`;
  return `${overs.slice(0, 2).join(", ")} i ${overs.length - 2} więcej`;
}

export function NutritionTodayView({
  model,
}: {
  model: MacroBalanceViewModel;
}) {
  const [filter, setFilter] = useState<MacroFilter>("all");
  const defaultExpanded = useMemo(() => {
    const first = model.pastDays.find((d) => d.status === "deviations");
    return first?.dateKey ?? null;
  }, [model.pastDays]);
  const [expandedKey, setExpandedKey] = useState<string | null>(defaultExpanded);

  const filteredDays = useMemo(() => {
    if (filter === "all") return model.pastDays;
    return model.pastDays.filter((d) =>
      d.deviations.some((dev) => dev.key === filter),
    );
  }, [filter, model.pastDays]);

  const visibleDeviationCount = useMemo(() => {
    if (filter === "all") return model.totalDeviations;
    return filteredDays.reduce(
      (n, d) => n + d.deviations.filter((x) => x.key === filter).length,
      0,
    );
  }, [filter, filteredDays, model.totalDeviations]);

  const filterCounts = useMemo(() => {
    return {
      all: model.totalDeviations,
      calories: model.deviationCountByMacro.calories,
      protein: model.deviationCountByMacro.protein,
      carbs: model.deviationCountByMacro.carbs,
      fat: model.deviationCountByMacro.fat,
    } satisfies Record<MacroFilter, number>;
  }, [model]);

  const today = model.today;
  const kcal = today?.macros.find((m) => m.key === "calories") ?? null;
  const tiles = (today?.macros ?? []).filter((m) => m.key !== "calories");
  const noEntriesToday = today != null && !today.hasEntries;

  const overNames = overMacroNames(model);
  const heroMeta =
    noEntriesToday
      ? "dzień w toku"
      : overNames
        ? `dzień w toku · ponad cel: ${overNames}`
        : "dzień w toku";

  const showDeviationsSection = model.pastDays.length > 0;
  const zeroDeviations =
    model.totalDeviations === 0 && model.period.daysWithEntries > 0;
  const emptyStart =
    model.period.daysWithEntries === 0 && noEntriesToday;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 pb-10 sm:px-5">
      <div className="flex items-start gap-2">
        <Link
          href="/meal-suggestions"
          className="mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--gym-border-gold)] bg-black/25 text-white/90"
          aria-label="Wróć do diety"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <AppPageHeader
          className="flex-1 pb-0 pt-0"
          kicker="MAKRO DZIŚ"
          title="Statystyki bilansu"
          description={model.weekRangeMeta}
        />
      </div>

      <section aria-labelledby="macro-today-heading" className="space-y-3">
        <SectionLabel
          index="01"
          title="Dziś"
          titleAs="h2"
          trailing={today ? <DayTypeChip dayType={today.dayType} /> : null}
        />
        <div
          id="macro-today-heading"
          className="app-card relative overflow-hidden p-4 sm:p-5"
          style={{
            boxShadow:
              "inset 0 1px 0 color-mix(in srgb, var(--gym-gold) 12%, transparent)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--gym-gold)_12%,transparent),transparent_70%)]"
            aria-hidden
          />
          {today && kcal ? (
            <div className="relative space-y-4">
              <p className="text-[12px] text-[var(--gym-text-secondary)]">
                {today.weekdayLabel}, {today.shortDateLabel} · {heroMeta}
              </p>
              {kcal.goal == null ? (
                <div className="space-y-2">
                  <p className="font-metric text-[40px] tabular-nums text-[var(--gym-gold)]">
                    {formatPlNumber(kcal.consumed)}{" "}
                    <span className="text-[16px] text-white/90">kcal</span>
                  </p>
                  <p className="text-[14px] text-[var(--gym-text-secondary)]">
                    Brak celu kalorii ·{" "}
                    <Link
                      href="/profile/diet"
                      className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
                    >
                      Ustaw cele w profilu
                    </Link>
                  </p>
                </div>
              ) : (
                <MacroTodayTile
                  macro={kcal}
                  inProgress
                  variant="hero"
                  emptyDay={noEntriesToday}
                />
              )}
              <div className="grid grid-cols-3 gap-2">
                {tiles.map((m) => (
                  <MacroTodayTile
                    key={m.key}
                    macro={m}
                    inProgress
                    emptyDay={noEntriesToday}
                  />
                ))}
              </div>
              {noEntriesToday ? (
                <div className="mt-4 space-y-3">
                  <p className="text-[13px] text-[var(--gym-text-secondary)]">
                    Nie zapisano jeszcze posiłków tego dnia.
                  </p>
                  <Link
                    href="/meal-suggestions"
                    className={cn(
                      // mirror Button cta for link-as-button
                      "gym-btn-primary inline-flex h-12 min-h-11 w-full items-center justify-center rounded-2xl px-6 text-base font-semibold tracking-[0.02em]",
                    )}
                  >
                    Dodaj posiłek
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-[14px] text-[var(--gym-text-secondary)]">
              Brak danych na dziś.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="macro-week-heading">
        <SectionLabel
          index="02"
          title="Tydzień PN→dziś"
          titleAs="h2"
          trailing={
            <Link
              href="/nutrition/week"
              className="inline-flex min-h-11 items-center text-[12px] font-semibold text-[var(--gym-gold)]"
            >
              Tydzień →
            </Link>
          }
        />
        <div id="macro-week-heading" className="app-card space-y-4 p-4 sm:p-5">
          {model.period.state === "no_data" ? (
            <EmptyNote>
              Tydzień zacznie się liczyć po pierwszym wpisie posiłku.
            </EmptyNote>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-[12px] text-[var(--gym-text-secondary)]">
                  {model.period.daysWithEntries} z {model.period.daysInWeek} dni
                  z wpisami
                </p>
                <Explainer label="Jak liczymy?">
                  Suma obejmuje dni z co najmniej jednym wpisem. Dzisiejszy dzień
                  jest w sumie w trakcie – odcinek jaśniejszy.
                </Explainer>
              </div>
              <div className="space-y-3.5">
                {model.period.macros.map((m) => (
                  <MacroMeter
                    key={m.key}
                    macro={m}
                    showTodayNote={m.key === "calories"}
                  />
                ))}
              </div>
              <WeekTrendBars days={model.trendDays} />
            </>
          )}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="macro-dev-heading">
        <SectionLabel
          index="03"
          title="Odchylenia"
          titleAs="h2"
          trailing={
            showDeviationsSection && !emptyStart && !zeroDeviations ? (
              <span className="tabular-nums text-[var(--gym-text-secondary)]">
                {visibleDeviationCount} w{" "}
                {filter === "all"
                  ? model.daysWithDeviations
                  : filteredDays.length}{" "}
                {filteredDays.length === 1 ||
                (filter === "all" && model.daysWithDeviations === 1)
                  ? "dniu"
                  : "dniach"}
              </span>
            ) : null
          }
        />
        <div id="macro-dev-heading" className="space-y-2.5">
          {emptyStart ? (
            <EmptyNote>
              Tu pojawią się odchylenia, gdy zapiszesz posiłki z kilku dni.
            </EmptyNote>
          ) : zeroDeviations ? (
            <EmptyNote>
              Brak odchyleń w zamkniętych dniach tego tygodnia.
            </EmptyNote>
          ) : (
            <>
              <MacroFilterChips
                value={filter}
                counts={filterCounts}
                onChange={setFilter}
              />
              <p className="sr-only" aria-live="polite">
                {filter === "all"
                  ? `Pokazuję ${model.daysWithDeviations} dni z odchyleniami`
                  : `Pokazuję ${filteredDays.length} dni z odchyleniem: ${filter === "protein" ? "białko" : filter === "carbs" ? "węgle" : filter === "fat" ? "tłuszcz" : "kalorie"}`}
              </p>
              <div className="grid gap-2.5 md:grid-cols-2">
                {filteredDays.map((day) => (
                  <DayBalanceCard
                    key={day.dateKey}
                    day={day}
                    expanded={expandedKey === day.dateKey}
                    onToggle={() =>
                      setExpandedKey((cur) =>
                        cur === day.dateKey ? null : day.dateKey,
                      )
                    }
                    filterKey={filter}
                  />
                ))}
              </div>
              {filteredDays.length === 0 ? (
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

// keep type export used by tests/docs
export type { MacroKey };
