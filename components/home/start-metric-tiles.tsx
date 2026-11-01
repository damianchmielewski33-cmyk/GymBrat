import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomeStartTodayMacros, HomeStartWeekMacros } from "@/lib/home-start";

function formatGrams(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

function formatKcal(n: number): string {
  return String(Math.round(n));
}

/**
 * Wspólne tory kolumn tabeli makro: nazwa | zjedzone | % | zostało.
 * Nagłówki i liczby używają tego samego szablonu i są wyrównane do prawej,
 * więc każdy nagłówek stoi dokładnie nad swoimi liczbami.
 */
const MACRO_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_3.25rem_2.75rem_4.75rem] items-baseline gap-x-2";

const NUM_CELL = "block text-right tabular-nums whitespace-nowrap";

function MacroRow({
  label,
  dotClass,
  barClass,
  remaining,
  goal,
  consumed,
}: {
  label: string;
  dotClass: string;
  barClass: string;
  remaining: number | null;
  goal: number | null;
  consumed: number;
}) {
  const pctRaw =
    goal != null && goal > 0
      ? Math.max(0, Math.round((consumed / goal) * 100))
      : null;
  const barPct = pctRaw == null ? 0 : Math.min(100, pctRaw);
  const over = goal != null && consumed > goal;

  let left: string;
  if (remaining == null) left = "—";
  else if (remaining >= 0) left = formatGrams(remaining);
  else left = `+${formatGrams(Math.abs(remaining))} ponad`;

  return (
    <div className="min-w-0">
      <div className={MACRO_GRID}>
        <span className="flex min-w-0 items-center gap-2 text-[14px] font-semibold leading-none text-white">
          <span
            className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", over ? "bg-rose-400" : dotClass)}
            aria-hidden
          />
          <span className="truncate">{label}</span>
        </span>
        <span className={cn(NUM_CELL, "text-[15px] font-semibold text-white")}>
          {formatGrams(consumed)}
        </span>
        <span
          className={cn(
            NUM_CELL,
            "text-[13px]",
            pctRaw == null
              ? "text-white/35"
              : over
                ? "font-semibold text-rose-400"
                : "text-white/55",
          )}
        >
          {pctRaw == null ? "—" : `${pctRaw}%`}
        </span>
        <span
          className={cn(
            NUM_CELL,
            "text-[15px] font-semibold",
            remaining == null
              ? "text-white/35"
              : over
                ? "text-rose-400"
                : "text-white",
          )}
        >
          {left}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            over ? "bg-rose-400" : barClass,
          )}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

function MacroProgressTile({
  title,
  macros,
  href,
  linkHint = "Kalendarz tygodnia",
}: {
  title: string;
  macros: HomeStartTodayMacros | HomeStartWeekMacros;
  href?: string;
  linkHint?: string;
}) {
  const hasGoals =
    macros.proteinGoal != null ||
    macros.carbsGoal != null ||
    macros.fatGoal != null;
  const kcalRemaining =
    macros.caloriesGoal != null && Number.isFinite(macros.caloriesGoal)
      ? Math.round(macros.caloriesGoal - macros.caloriesConsumed)
      : null;
  const kcalOver = kcalRemaining != null && kcalRemaining < 0;

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          {title}
        </p>
        <p className="text-[12px] text-white/55">w gramach</p>
      </div>

      {kcalRemaining != null ? (
        <div className="mt-4 flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/60">
            pozostałe kcal
          </span>
          <span
            className={cn(
              "flex items-baseline gap-1.5 leading-none tabular-nums",
              kcalOver ? "text-rose-400" : "text-white",
            )}
          >
            <span className="font-display text-[38px] tracking-wide">
              {kcalOver ? "+" : ""}
              {formatKcal(Math.abs(kcalRemaining))}
            </span>
            <span className="text-[13px] font-medium text-white/60">kcal</span>
          </span>
        </div>
      ) : null}

      {hasGoals ? (
        <div className={cn(MACRO_GRID, "mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/55")}>
          <span aria-hidden />
          <span className={NUM_CELL}>zjedzone</span>
          <span className={NUM_CELL}>%</span>
          <span className={NUM_CELL}>zostało</span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-1 flex-col justify-center gap-4">
        <MacroRow
          label="Białko"
          dotClass="bg-sky-400"
          barClass="bg-sky-400"
          remaining={macros.proteinRemaining}
          goal={macros.proteinGoal}
          consumed={macros.proteinConsumed}
        />
        <MacroRow
          label="Węglowodany"
          dotClass="bg-violet-400"
          barClass="bg-violet-400"
          remaining={macros.carbsRemaining}
          goal={macros.carbsGoal}
          consumed={macros.carbsConsumed}
        />
        <MacroRow
          label="Tłuszcze"
          dotClass="bg-amber-400"
          barClass="bg-amber-400"
          remaining={macros.fatRemaining}
          goal={macros.fatGoal}
          consumed={macros.fatConsumed}
        />
      </div>

      {!hasGoals ? (
        <p className="mt-4 text-[12px] leading-tight text-white/45">
          Ustaw cele w profilu
        </p>
      ) : href ? (
        <p className="mt-5 inline-flex items-center gap-2 text-[14px] font-medium leading-tight text-[var(--gym-gold)]">
          {linkHint}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </p>
      ) : null}
    </>
  );

  const className =
    "app-card gym-tap flex flex-col px-4 py-4 hover:bg-white/[0.02]";

  if (href) {
    return (
      <Link
        href={href}
        className={cn(className, "col-span-2")}
        aria-label={`${title} — otwórz szczegóły makro`}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={cn(className, "col-span-2 !transform-none")}>{body}</div>
  );
}

export function StartMetricTiles({
  todayMacros,
  weekMacros,
}: {
  todayMacros: HomeStartTodayMacros;
  weekMacros: HomeStartWeekMacros;
}) {
  return (
    <section className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <MacroProgressTile
          title="Makro dziś"
          macros={todayMacros}
          href="/nutrition/today"
          linkHint="Bilans i odchylenia"
        />
        <MacroProgressTile
          title="Makro tydzień"
          macros={weekMacros}
          href="/nutrition/week"
        />
      </div>
    </section>
  );
}
