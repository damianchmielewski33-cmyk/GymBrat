"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { NutritionWeekRollup } from "@/lib/nutrition-goals";
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
>;

function WeekMacroRemainderCard({ rollup }: { rollup: WeekRollupPick }) {
  const items: {
    label: string;
    unit: string;
    remain: number;
    hasGoal: boolean;
  }[] = [
    {
      label: "Białko",
      unit: "g",
      remain: rollup.sumProteinGoal - rollup.sumProteinConsumed,
      hasGoal: rollup.sumProteinGoal > 0,
    },
    {
      label: "Tłuszcz",
      unit: "g",
      remain: rollup.sumFatGoal - rollup.sumFatConsumed,
      hasGoal: rollup.sumFatGoal > 0,
    },
    {
      label: "Węglowodany",
      unit: "g",
      remain: rollup.sumCarbsGoal - rollup.sumCarbsConsumed,
      hasGoal: rollup.sumCarbsGoal > 0,
    },
  ];

  const anyGoal = items.some((i) => i.hasGoal);
  if (!anyGoal) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100/90">
        Ustaw cele makro w profilu (trening / odpoczynek), żeby zobaczyć ile gramów zostało do
        domknięcia tygodnia.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/50">
        Bilans tygodnia (pon.–niedz.)
      </p>
      <p className="mt-1 text-sm text-white/70">
        Różnica: suma celów tygodnia minus suma spożycia z wpisów — ile zostało do „domknięcia”
        makr w skali całego tygodnia.
      </p>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((i) => {
          if (!i.hasGoal) {
            return (
              <li
                key={i.label}
                className="flex items-baseline justify-between gap-2 text-white/45"
              >
                <span>{i.label}</span>
                <span className="text-xs">brak sumy celów</span>
              </li>
            );
          }
          const r = Math.round(i.remain);
          let tone: string;
          let desc: string;
          if (r > 0) {
            tone = "text-sky-200";
            desc = `brakuje jeszcze ok. ${r} ${i.unit}`;
          } else if (r < 0) {
            tone = "text-rose-200";
            desc = `nadwyżka ok. ${Math.abs(r)} ${i.unit} względem sumy celów`;
          } else {
            tone = "text-emerald-200";
            desc = "zgodnie z sumą celów tygodnia";
          }
          return (
            <li key={i.label} className="flex items-baseline justify-between gap-2">
              <span className="text-white/70">{i.label}</span>
              <span className={`font-medium ${tone}`}>{desc}</span>
            </li>
          );
        })}
      </ul>
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
}: {
  rows: WeekDayNutritionRow[];
  todayKey?: string;
  weekRollup?: WeekRollupPick;
}) {
  const pastRows = todayKey
    ? rows.filter((r) => r.dateKey < todayKey)
    : [];
  const todayRow = todayKey ? rows.find((r) => r.dateKey === todayKey) : undefined;
  const futureRows = todayKey
    ? rows.filter((r) => r.dateKey > todayKey)
    : rows;

  const flatLegacy = !todayKey;

  return (
    <div className="max-h-[min(75vh,620px)] space-y-4 overflow-y-auto pr-1">
      <p className="text-xs text-white/45">
        Poniedziałek–niedziela bieżącego tygodnia (strefa jak na stronie Start). Spożycie to suma
        wpisów posiłków na dany dzień; przy celu — bilans względem profilu.
      </p>

      {weekRollup ? <WeekMacroRemainderCard rollup={weekRollup} /> : null}

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
