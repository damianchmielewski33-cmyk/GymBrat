"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check } from "lucide-react";
import {
  formatPlNumber,
  MACRO_TOLERANCE_PP,
  type MacroKey,
  type WeekAverage,
  type WeekTrendDay,
} from "@/lib/nutrition-day-balance";
import { cn } from "@/lib/utils";

const TABS: { key: MacroKey; label: string; unit: "g" | "kcal" }[] = [
  { key: "calories", label: "Kalorie", unit: "kcal" },
  { key: "protein", label: "Białko", unit: "g" },
  { key: "carbs", label: "Węgle", unit: "g" },
  { key: "fat", label: "Tłuszcz", unit: "g" },
];

const CHART_H = 150;

function pickInitial(days: WeekTrendDay[]): string | null {
  const today = days.find((d) => d.kind === "today");
  if (today && today.caloriesConsumed > 0) return today.dateKey;
  const lastFilled = [...days].reverse().find((d) => d.kind === "filled");
  return lastFilled?.dateKey ?? null;
}

/**
 * Wykres tygodnia: słupki dnia jako % celu wybranego makro, linia celu (100%),
 * pasmo normy (±5 pp), wartości nad słupkami i panel porównań po dotknięciu dnia.
 */
export function WeekTrendBars({
  days,
  averages,
}: {
  days: WeekTrendDay[];
  averages?: WeekAverage[];
}) {
  const [macro, setMacro] = useState<MacroKey>("calories");
  const [selected, setSelected] = useState<string | null>(() => pickInitial(days));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const tab = TABS.find((t) => t.key === macro)!;
  const avg = averages?.find((a) => a.key === macro) ?? null;

  const scaleMax = useMemo(() => {
    const top = Math.max(
      0,
      ...days.map((d) => d.macros[macro].pct ?? 0),
    );
    return Math.min(200, Math.max(125, Math.ceil(top / 25) * 25));
  }, [days, macro]);

  const activeIdx = days.findIndex((d) => d.dateKey === selected);
  const active = activeIdx >= 0 ? days[activeIdx]! : null;
  const prev = activeIdx > 0 ? days[activeIdx - 1]! : null;
  const goalLine = (100 / scaleMax) * 100;
  const bandBottom = ((100 - MACRO_TOLERANCE_PP) / scaleMax) * 100;
  const bandHeight = ((MACRO_TOLERANCE_PP * 2) / scaleMax) * 100;

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--gym-border-gold)] pt-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
          Dzień po dniu, % celu
        </p>
        <p className="mt-1 text-[12px] leading-snug text-[var(--gym-text-secondary)]">
          Słupek na linii celu = zjedzone dokładnie tyle, ile w planie. Zielone
          pasmo to norma (±{MACRO_TOLERANCE_PP}%). Dotknij dnia, by zobaczyć
          porównanie.
        </p>
      </div>

      <div role="group" aria-label="Wybierz makro" className="chip-scroll">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={macro === t.key}
            onClick={() => setMacro(t.key)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center rounded-full border px-3.5 text-[12px] font-semibold transition-colors",
              macro === t.key
                ? "border-[color-mix(in_srgb,var(--gym-gold)_60%,transparent)] bg-[color-mix(in_srgb,var(--gym-gold)_14%,transparent)] text-white"
                : "border-[var(--gym-border-gold)] text-white/80",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5" role="group" aria-label={`${tab.label} w tygodniu, procent celu`}>
        <div
          className="relative flex-1"
          style={{ height: CHART_H + 44 }}
        >
          <div
            className="absolute inset-x-0"
            style={{ top: 22, height: CHART_H }}
            aria-hidden
          >
            <div
              className="absolute inset-x-0 rounded-sm bg-[color-mix(in_srgb,var(--gym-trend-up)_14%,transparent)]"
              style={{ bottom: `${bandBottom}%`, height: `${bandHeight}%` }}
            />
            <div
              className="absolute inset-x-0 border-t border-dashed border-[var(--gym-gold)]/70"
              style={{ bottom: `${goalLine}%` }}
            />
            <span
              className="absolute right-0 rounded bg-black/60 px-1 text-[10px] font-semibold text-[var(--gym-gold)]"
              style={{ bottom: `calc(${goalLine}% + 2px)` }}
            >
              cel
            </span>
          </div>
          <div className="relative flex h-full items-end justify-between gap-1">
            {days.map((d, i) => {
              const m = d.macros[macro];
              const noData = d.kind === "empty";
              const noGoal = !noData && m.goal == null;
              const pct = m.pct ?? 0;
              const over = Math.max(0, Math.min(pct, scaleMax) - 100);
              const base = Math.min(pct, 100, scaleMax);
              const hBase = ready ? (base / scaleMax) * CHART_H : 0;
              const hOver = ready ? (over / scaleMax) * CHART_H : 0;
              const isSel = selected === d.dateKey;
              const Arrow =
                m.status === "surplus"
                  ? ArrowUpRight
                  : m.status === "deficit"
                    ? ArrowDownRight
                    : m.status === "on_track"
                      ? Check
                      : null;
              return (
                <button
                  key={d.dateKey}
                  type="button"
                  aria-pressed={isSel}
                  aria-label={`${d.kind === "today" ? "dziś" : d.label}: ${
                    noData
                      ? "brak wpisów"
                      : noGoal
                        ? `${Math.round(m.consumed)} ${tab.unit}, brak celu`
                        : `${m.pct} procent celu, ${Math.round(m.consumed)} z ${Math.round(m.goal!)} ${tab.unit}`
                  }`}
                  onClick={() => setSelected(d.dateKey)}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
                >
                  <span
                    className={cn(
                      "mb-1 flex h-[18px] items-center gap-0.5 text-[11px] font-semibold tabular-nums",
                      isSel ? "text-white" : "text-white/70",
                    )}
                  >
                    {noData ? "—" : noGoal ? "" : `${m.pct}%`}
                    {Arrow ? <Arrow className="h-3 w-3" aria-hidden /> : null}
                  </span>
                  <div
                    className="relative flex w-full flex-col items-center justify-end"
                    style={{ height: CHART_H }}
                  >
                    {noData || noGoal ? (
                      <div
                        className="w-[58%] rounded-sm border border-dashed border-[var(--gym-text-secondary)]/50"
                        style={{ height: 14 }}
                      />
                    ) : (
                      <div
                        className={cn(
                          "flex w-[58%] flex-col justify-end overflow-hidden rounded-t-md transition-[height,box-shadow] duration-500 ease-out motion-reduce:transition-none",
                          isSel && "shadow-[0_0_0_1.5px_var(--gym-gold)]",
                        )}
                        style={{
                          height: Math.max(6, hBase + hOver),
                          transitionDelay: ready ? `${i * 35}ms` : "0ms",
                        }}
                      >
                        {hOver > 0 ? (
                          <div
                            className="w-full bg-white/80"
                            style={{ height: hOver }}
                          />
                        ) : null}
                        <div
                          className={cn(
                            "w-full flex-1",
                            d.kind === "today"
                              ? "bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--gym-gold)_55%,transparent)_0_4px,color-mix(in_srgb,var(--gym-gold)_25%,transparent)_4px_8px)]"
                              : m.status === "on_track"
                                ? "bg-[var(--gym-trend-up)]"
                                : "bg-[var(--gym-gold)]",
                          )}
                        />
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-1.5 text-[11px]",
                      d.kind === "today"
                        ? "font-semibold text-white"
                        : "text-[var(--gym-text-secondary)]",
                    )}
                  >
                    {d.kind === "today" ? "dziś" : d.weekdayShort}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--gym-text-secondary)]">
        <Legend color="var(--gym-gold)" label="do celu" />
        <Legend color="var(--gym-trend-up)" label="w normie" />
        <Legend color="rgba(255,255,255,0.8)" label="ponad cel" />
        <Legend dashed label="dziś w toku" />
      </p>

      <DayCompare
        day={active}
        prev={prev}
        macro={macro}
        tab={tab}
        avg={avg}
      />

      <ul className="sr-only">
        {days.map((d) => (
          <li key={`sr-${d.dateKey}`}>{d.ariaLabel}</li>
        ))}
      </ul>
    </div>
  );
}

function Legend({
  color,
  label,
  dashed,
}: {
  color?: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden
        className={cn(
          "inline-block h-2.5 w-2.5 rounded-sm",
          dashed && "border border-dashed border-[var(--gym-gold)]",
        )}
        style={color ? { background: color } : undefined}
      />
      {label}
    </span>
  );
}

function signed(n: number, unit: string): string {
  const r = Math.round(n);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${formatPlNumber(Math.abs(r))} ${unit}`;
}

function DayCompare({
  day,
  prev,
  macro,
  tab,
  avg,
}: {
  day: WeekTrendDay | null;
  prev: WeekTrendDay | null;
  macro: MacroKey;
  tab: { label: string; unit: "g" | "kcal" };
  avg: WeekAverage | null;
}) {
  if (!day) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--gym-border-gold)] px-3 py-3 text-[12px] text-[var(--gym-text-secondary)]">
        Dotknij słupka, aby zobaczyć szczegóły dnia.
      </p>
    );
  }
  const m = day.macros[macro];
  if (day.kind === "empty") {
    return (
      <p className="rounded-2xl border border-[var(--gym-border-gold)] bg-black/25 px-3 py-3 text-[12px] text-[var(--gym-text-secondary)]" aria-live="polite">
        {day.label}: brak wpisów, więc dzień nie wchodzi do średniej.
      </p>
    );
  }
  const delta = m.goal != null ? m.consumed - m.goal : null;
  const verdict =
    delta == null
      ? "brak celu"
      : m.status === "on_track"
        ? "w normie"
        : delta > 0
          ? `ponad cel o ${signed(delta, tab.unit).replace("+", "")}`
          : `brakuje ${signed(delta, tab.unit).replace("−", "")}`;
  const rows: { label: string; value: string }[] = [];
  if (avg && avg.daysCounted > 0 && day.kind !== "today") {
    rows.push({
      label: "vs średnia dzienna tygodnia",
      value: signed(m.consumed - avg.avgConsumed, tab.unit),
    });
  } else if (avg && avg.daysCounted > 0) {
    rows.push({
      label: "vs średnia zamkniętych dni",
      value: signed(m.consumed - avg.avgConsumed, tab.unit),
    });
  }
  if (prev && prev.kind !== "empty") {
    rows.push({
      label: `vs ${prev.label.toLowerCase()}`,
      value: signed(m.consumed - prev.macros[macro].consumed, tab.unit),
    });
  }
  return (
    <div
      className="space-y-2 rounded-2xl border border-[var(--gym-border-gold)] bg-black/25 p-3"
      aria-live="polite"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px] font-semibold text-white">
          {day.kind === "today" ? "Dziś" : day.label}{" "}
          <span className="text-[12px] font-normal text-[var(--gym-text-secondary)]">
            · {tab.label}
            {day.kind === "today" ? " · w toku" : ""}
          </span>
        </p>
        {m.pct != null ? (
          <p className="font-metric text-[20px] tabular-nums text-[var(--gym-gold)]">
            {m.pct}%
          </p>
        ) : null}
      </div>
      <p className="text-[13px] tabular-nums text-white/90">
        {formatPlNumber(m.consumed)}
        {m.goal != null ? ` z ${formatPlNumber(m.goal)}` : ""} {tab.unit}
        <span className="text-[var(--gym-text-secondary)]"> · {verdict}</span>
      </p>
      {rows.length ? (
        <dl className="divide-y divide-white/[0.06] text-[12px]">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-2 py-1.5">
              <dt className="text-[var(--gym-text-secondary)]">{r.label}</dt>
              <dd className="font-semibold tabular-nums text-white/90">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
