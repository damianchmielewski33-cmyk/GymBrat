"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Beef, ChevronDown, Droplets, Flame, Wheat } from "lucide-react";
import type { NutritionWeekRollup } from "@/lib/nutrition-goals";
import type { PreviousWeekNutritionSheetWeek } from "@/lib/nutrition-dashboard";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";

function MetricBlock({
  label,
  consumed,
  goal,
  unit,
}: {
  label: string;
  consumed: number;
  goal: number | null;
  unit: string;
}) {
  const c = Math.round(consumed);
  if (goal == null) {
    return (
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-white/55">{label}</span>
        <span className="font-mono text-white/85">
          {c} {unit}
          <span className="ml-1 text-[11px] font-sans text-white/40">
            (brak celu)
          </span>
        </span>
      </div>
    );
  }
  const g = Math.round(goal);
  const diff = g - c;

  let status: ReactNode;
  if (diff > 0) {
    status = (
      <span className="text-sky-200/95">
        Brakuje {Math.round(diff)} {unit} do celu
      </span>
    );
  } else if (diff < 0) {
    status = (
      <span className="text-rose-300/95">
        Przekroczenie o {Math.round(Math.abs(diff))} {unit}
      </span>
    );
  } else {
    status = <span className="text-emerald-300/90">Zgodnie z celem</span>;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-white/60">{label}</span>
        <span className="font-mono text-xs text-white/80">
          {c} / {g} {unit}
        </span>
      </div>
      <p className="text-xs text-white/50">{status}</p>
    </div>
  );
}

function DayNutritionCard({ row }: { row: WeekDayNutritionRow }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="font-medium text-white">{row.headline}</p>
      <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
        <MetricBlock
          label="Kalorie"
          consumed={row.caloriesConsumed}
          goal={row.caloriesGoal}
          unit="kcal"
        />
        <MetricBlock
          label="Białko"
          consumed={row.proteinConsumed}
          goal={row.proteinGoal}
          unit="g"
        />
        <MetricBlock
          label="Węglowodany"
          consumed={row.carbsConsumed}
          goal={row.carbsGoal}
          unit="g"
        />
        <MetricBlock
          label="Tłuszcz"
          consumed={row.fatConsumed}
          goal={row.fatGoal}
          unit="g"
        />
      </div>
    </li>
  );
}

type WeekRollupPick = Pick<
  NutritionWeekRollup,
  | "sumProteinGoal"
  | "sumProteinConsumed"
  | "sumFatGoal"
  | "sumFatConsumed"
  | "sumCarbsGoal"
  | "sumCarbsConsumed"
  | "sumCaloriesGoal"
  | "sumCaloriesConsumed"
>;

function MacroGaugeRow({
  label,
  icon,
  consumed,
  goal,
  unit,
  gradientClass,
  compact,
}: {
  label: string;
  icon: ReactNode;
  consumed: number;
  goal: number | null;
  unit: string;
  gradientClass: string;
  compact?: boolean;
}) {
  const g = goal != null && goal > 0 ? goal : null;
  const widthPct = g ? Math.min(100, (consumed / g) * 100) : 0;
  const remain = g != null ? g - consumed : null;
  const barH = compact ? "h-2.5" : "h-3.5";

  let statusText: string;
  let statusClass: string;
  if (remain == null) {
    statusText =
      unit === "kcal"
        ? `${Math.round(consumed)} kcal (bez sumy celów tygodnia)`
        : `${Math.round(consumed)} ${unit}`;
    statusClass = "text-white/50";
  } else if (remain > 0) {
    statusText = `Do celu brakuje ok. ${Math.round(remain)} ${unit}`;
    statusClass = "text-sky-200/95";
  } else if (remain < 0) {
    statusText = `Nadwyżka ok. ${Math.round(Math.abs(remain))} ${unit}`;
    statusClass = "text-rose-200/95";
  } else {
    statusText = "Zgodnie z sumą celów tygodnia";
    statusClass = "text-emerald-200/95";
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 font-medium text-white/90">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-[var(--neon)]">
            {icon}
          </span>
          {label}
        </span>
        <span className="font-mono text-xs text-white/75">
          {Math.round(consumed)}
          {g != null ? ` / ${Math.round(g)}` : ""} {unit}
        </span>
      </div>
      <div
        className={`relative w-full overflow-hidden rounded-full bg-white/10 ${barH}`}
      >
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${gradientClass}`}
          initial={{ width: 0 }}
          animate={{ width: g ? `${widthPct}%` : "0%" }}
          transition={{ duration: 0.65, ease: "easeOut" }}
        />
      </div>
      {!compact ? (
        <p className={`text-xs ${statusClass}`}>{statusText}</p>
      ) : (
        <p className={`text-[11px] leading-snug ${statusClass}`}>{statusText}</p>
      )}
    </div>
  );
}

function WeekMacroBalanceVisual({
  rollup,
  compact,
}: {
  rollup: WeekRollupPick;
  compact?: boolean;
}) {
  const hasMacroGoals =
    rollup.sumProteinGoal > 0 ||
    rollup.sumFatGoal > 0 ||
    rollup.sumCarbsGoal > 0;
  const hasKcalGoal = rollup.sumCaloriesGoal > 0;

  if (!hasMacroGoals && !hasKcalGoal) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100/90">
        Ustaw cele makro w profilu (trening / odpoczynek), żeby zobaczyć bilans tygodnia na
        wykresach.
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] ${compact ? "p-3" : "p-5"}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(720px_240px_at_10%_0%,rgba(255,45,85,0.12),transparent_55%)]" />
      <div className="relative space-y-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
            Bilans tygodnia (pon.–niedz.)
          </p>
          {!compact ? (
            <p className="mt-1 text-sm text-white/65">
              Pasek = udział spożycia w sumie celów tygodnia. Pełna szerokość = 100% celu zbiorczego
              za te 7 dni.
            </p>
          ) : null}
        </div>

        <div className={compact ? "space-y-3" : "space-y-5"}>
          {hasKcalGoal ? (
            <MacroGaugeRow
              label="Kalorie"
              icon={<Flame className="h-4 w-4" />}
              consumed={rollup.sumCaloriesConsumed}
              goal={rollup.sumCaloriesGoal}
              unit="kcal"
              gradientClass="from-amber-400 via-orange-400 to-rose-400"
              compact={compact}
            />
          ) : null}

          {rollup.sumProteinGoal > 0 ? (
            <MacroGaugeRow
              label="Białko"
              icon={<Beef className="h-4 w-4" />}
              consumed={rollup.sumProteinConsumed}
              goal={rollup.sumProteinGoal}
              unit="g"
              gradientClass="from-sky-400 to-cyan-300"
              compact={compact}
            />
          ) : null}

          {rollup.sumFatGoal > 0 ? (
            <MacroGaugeRow
              label="Tłuszcz"
              icon={<Droplets className="h-4 w-4" />}
              consumed={rollup.sumFatConsumed}
              goal={rollup.sumFatGoal}
              unit="g"
              gradientClass="from-amber-300 to-yellow-500"
              compact={compact}
            />
          ) : null}

          {rollup.sumCarbsGoal > 0 ? (
            <MacroGaugeRow
              label="Węglowodany"
              icon={<Wheat className="h-4 w-4" />}
              consumed={rollup.sumCarbsConsumed}
              goal={rollup.sumCarbsGoal}
              unit="g"
              gradientClass="from-violet-400 to-fuchsia-400"
              compact={compact}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PreviousWeeksSection({ weeks }: { weeks: PreviousWeekNutritionSheetWeek[] }) {
  const [open, setOpen] = useState(false);

  if (weeks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[var(--neon)]/50"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/55 transition ${open ? "rotate-180" : ""}`}
        />
        {open ? "Ukryj dane z poprzednich tygodni" : "Pokaż dane z poprzednich tygodni"}
      </button>

      {open ? (
        <div className="mt-4 space-y-4">
          {weeks.map((w) => (
            <div
              key={w.weekStart}
              className="rounded-2xl border border-white/10 bg-black/25 p-4"
            >
              <p className="text-sm font-semibold text-white">{w.weekLabel}</p>
              <p className="mt-0.5 text-[11px] text-white/45">
                Archiwum — ten sam sposób liczenia co bieżący tydzień (wpisy posiłków vs cele).
              </p>
              <div className="mt-3">
                <WeekMacroBalanceVisual rollup={w.rollup} compact />
              </div>
              <details className="group mt-3 rounded-xl border border-white/10 bg-white/[0.03]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium text-white outline-none marker:content-none [&::-webkit-details-marker]:hidden">
                  <span>Szczegóły dni ({w.dayRows.length})</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/45 transition group-open:rotate-180" />
                </summary>
                <div className="border-t border-white/10 px-3 pb-3 pt-2">
                  <ul className="space-y-3">
                    {w.dayRows.map((row) => (
                      <DayNutritionCard key={row.dateKey} row={row} />
                    ))}
                  </ul>
                </div>
              </details>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const NET_MACRO_THRESH = 12;

function aggregatePastMacroNet(
  pastRows: WeekDayNutritionRow[],
  read: (row: WeekDayNutritionRow) => { consumed: number; goal: number | null },
): { net: number; days: number } {
  let net = 0;
  let days = 0;
  for (const row of pastRows) {
    const { consumed, goal } = read(row);
    if (goal == null || goal <= 0) continue;
    days += 1;
    net += consumed - goal;
  }
  return { net, days };
}

function pastDaysMacroSummary(pastRows: WeekDayNutritionRow[]): ReactNode {
  const macros = [
    {
      label: "Białko",
      ...aggregatePastMacroNet(pastRows, (r) => ({
        consumed: r.proteinConsumed,
        goal: r.proteinGoal,
      })),
    },
    {
      label: "Tłuszcz",
      ...aggregatePastMacroNet(pastRows, (r) => ({
        consumed: r.fatConsumed,
        goal: r.fatGoal,
      })),
    },
    {
      label: "Węglowodany",
      ...aggregatePastMacroNet(pastRows, (r) => ({
        consumed: r.carbsConsumed,
        goal: r.carbsGoal,
      })),
    },
  ];

  const lines: string[] = [];

  for (const { label, net, days } of macros) {
    if (days === 0) continue;

    if (net < -NET_MACRO_THRESH) {
      lines.push(
        `${label}: w minionych dniach łącznie było za mało (ok. ${Math.round(Math.abs(net))} g poniżej celów) — możesz to nadrobić.`,
      );
    } else if (net > NET_MACRO_THRESH) {
      lines.push(
        `${label}: w minionych dniach łącznie było za dużo (ok. ${Math.round(net)} g ponad cele) — warto ograniczyć.`,
      );
    } else {
      lines.push(`${label}: w minionych dniach bilans jest zbliżony do celów.`);
    }
  }

  if (lines.length === 0) {
    return (
      <p className="text-xs text-white/45">
        Brak minionych dni z ustawionymi celami makro — podpowiedź pojawi się po kolejnych
        wpisach.
      </p>
    );
  }

  return (
    <ul className="list-disc space-y-1.5 pl-4 text-xs text-white/65">
      {lines.map((line, idx) => (
        <li key={idx}>{line}</li>
      ))}
    </ul>
  );
}

export function WeekNutritionSheetBody({
  rows,
  todayKey,
  weekRollup,
  previousWeeks,
}: {
  rows: WeekDayNutritionRow[];
  todayKey?: string;
  weekRollup?: WeekRollupPick;
  previousWeeks?: PreviousWeekNutritionSheetWeek[];
}) {
  const pastRows = todayKey ? rows.filter((r) => r.dateKey < todayKey) : [];
  const todayRow = todayKey ? rows.find((r) => r.dateKey === todayKey) : undefined;
  const futureRows = todayKey ? rows.filter((r) => r.dateKey > todayKey) : rows;

  const flatLegacy = !todayKey;

  return (
    <div className="max-h-[min(75vh,620px)] space-y-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <p className="text-xs text-white/45">
        Poniedziałek–niedziela bieżącego tygodnia (strefa jak na stronie Start). Spożycie to suma
        wpisów posiłków na dany dzień; przy celu — bilans względem profilu.
      </p>

      {weekRollup ? <WeekMacroBalanceVisual rollup={weekRollup} /> : null}

      {previousWeeks?.length ? <PreviousWeeksSection weeks={previousWeeks} /> : null}

      {!flatLegacy && pastRows.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
            Minione dni w tygodniu
          </p>
          <p className="mt-2 text-xs text-white/55">
            Poniżej wskazówka wg bilansu (spożycie − cel) tylko za dni już minione — czy raczej
            nadrobić makra, czy raczej je ograniczyć.
          </p>
          <div className="mt-3">{pastDaysMacroSummary(pastRows)}</div>
        </div>
      ) : null}

      {!flatLegacy && todayRow ? (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
            Dziś
          </p>
          <ul className="space-y-3">
            <DayNutritionCard row={todayRow} />
          </ul>
        </div>
      ) : null}

      {!flatLegacy && pastRows.length > 0 ? (
        <details className="group rounded-2xl border border-white/10 bg-white/[0.03]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-white outline-none marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Wcześniejsze dni tygodnia ({pastRows.length})</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-white/45 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-white/10 px-4 pb-4 pt-2">
            <ul className="space-y-3">
              {pastRows.map((row) => (
                <DayNutritionCard key={row.dateKey} row={row} />
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      {!flatLegacy && futureRows.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
            Nadchodzące dni
          </p>
          <ul className="space-y-3">
            {futureRows.map((row) => (
              <DayNutritionCard key={row.dateKey} row={row} />
            ))}
          </ul>
        </div>
      ) : null}

      {flatLegacy ? (
        <ul className="space-y-3">
          {rows.map((row) => (
            <DayNutritionCard key={row.dateKey} row={row} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
