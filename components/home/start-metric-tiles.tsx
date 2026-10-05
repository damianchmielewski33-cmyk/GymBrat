import { Activity, Scale, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HomeStartTodayMacros, HomeStartWeekMacros } from "@/lib/home-start";

function formatKg(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function formatSignedKg(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${String(rounded).replace(".", ",")}`;
}

function formatGrams(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

function MetricTile({
  label,
  value,
  unit,
  hint,
  hintTone = "muted",
  Icon,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  hintTone?: "muted" | "gold" | "good" | "bad";
  Icon: LucideIcon;
}) {
  return (
    <div className="app-card flex min-h-[118px] flex-col px-3.5 py-3.5">
      <div className="flex items-center gap-2">
        <Icon
          className="h-[18px] w-[18px] shrink-0 text-[var(--gym-gold)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          {label}
        </p>
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-[34px] leading-none tracking-wide text-white">
          {value}
        </span>
        {unit ? (
          <span className="text-[13px] font-medium text-white/50">{unit}</span>
        ) : null}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-auto pt-2 text-[11px] leading-snug",
            hintTone === "gold" && "text-[var(--gym-gold)]/85",
            hintTone === "good" && "text-emerald-400",
            hintTone === "bad" && "text-rose-400",
            hintTone === "muted" && "text-white/40",
          )}
        >
          {hint}
        </p>
      ) : (
        <div className="mt-auto pt-2" />
      )}
    </div>
  );
}

function MacroRemainRow({
  label,
  remaining,
  goal,
  consumed,
  barClass,
}: {
  label: string;
  remaining: number | null;
  goal: number | null;
  consumed: number;
  barClass: string;
}) {
  const pctRaw =
    goal != null && goal > 0
      ? Math.max(0, Math.round((consumed / goal) * 100))
      : null;
  const barPct = pctRaw == null ? 0 : Math.min(100, pctRaw);
  const over = goal != null && consumed > goal;
  const eaten = formatGrams(consumed);
  const left =
    remaining == null
      ? null
      : remaining >= 0
        ? formatGrams(remaining)
        : formatGrams(Math.abs(remaining));

  return (
    <div className="min-w-0 space-y-1">
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-baseline gap-x-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-white/50">
          {label}
        </span>
        <span className="tabular-nums text-[12px] font-medium leading-none text-white">
          {eaten}
          <span className="ml-0.5 text-[10px] font-normal text-white/35">g</span>
        </span>
        <span
          className={cn(
            "text-right tabular-nums text-[11px] font-semibold leading-none",
            pctRaw == null
              ? "text-white/30"
              : over
                ? "text-rose-400"
                : "text-white/55",
          )}
        >
          {pctRaw == null ? "—" : `${pctRaw}%`}
        </span>
        <span
          className={cn(
            "text-right tabular-nums text-[12px] font-medium leading-none",
            left == null
              ? "text-white/35"
              : over
                ? "text-rose-400"
                : "text-white/80",
          )}
        >
          {left == null ? (
            "—"
          ) : (
            <>
              {over ? "+" : ""}
              {left}
              <span className="ml-0.5 text-[10px] font-normal text-white/35">
                g
              </span>
            </>
          )}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
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

function formatKcal(n: number): string {
  return String(Math.round(n));
}

function MacroProgressTile({
  title,
  macros,
}: {
  title: string;
  macros: HomeStartTodayMacros | HomeStartWeekMacros;
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

  return (
    <div className="app-card flex min-h-[118px] flex-col px-3.5 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
        {title}
      </p>
      {kcalRemaining != null ? (
        <div className="mt-2 flex items-baseline justify-between gap-2 border-b border-white/[0.06] pb-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
            pozostałe kcal
          </span>
          <span
            className={cn(
              "tabular-nums text-[15px] font-semibold leading-none",
              kcalOver ? "text-rose-400" : "text-white",
            )}
          >
            {kcalOver ? "+" : ""}
            {formatKcal(Math.abs(kcalRemaining))}
            <span className="ml-0.5 text-[10px] font-normal text-white/40">
              kcal
            </span>
          </span>
        </div>
      ) : null}
      {hasGoals ? (
        <div
          className={cn(
            "grid grid-cols-[1.5rem_minmax(0,1fr)_2.75rem_minmax(0,1fr)] gap-x-1.5",
            kcalRemaining != null ? "mt-2" : "mt-2.5",
          )}
        >
          <span aria-hidden />
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
            zjedz.
          </span>
          <span className="text-right text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
            %
          </span>
          <span className="text-right text-[9px] font-semibold uppercase tracking-[0.1em] text-white/35">
            zostało
          </span>
        </div>
      ) : null}
      <div className="mt-1.5 flex flex-1 flex-col justify-center gap-2.5">
        <MacroRemainRow
          label="B"
          remaining={macros.proteinRemaining}
          goal={macros.proteinGoal}
          consumed={macros.proteinConsumed}
          barClass="bg-sky-400"
        />
        <MacroRemainRow
          label="W"
          remaining={macros.carbsRemaining}
          goal={macros.carbsGoal}
          consumed={macros.carbsConsumed}
          barClass="bg-violet-400"
        />
        <MacroRemainRow
          label="T"
          remaining={macros.fatRemaining}
          goal={macros.fatGoal}
          consumed={macros.fatConsumed}
          barClass="bg-amber-400"
        />
      </div>
      {!hasGoals ? (
        <p className="mt-2 text-[10px] text-white/35">Ustaw cele w profilu</p>
      ) : null}
    </div>
  );
}

export function StartMetricTiles({
  weightKg,
  tempoKgPerMin,
  weightFromStartKg,
  weightDeltaFromPreviousKg,
  todayMacros,
  weekMacros,
}: {
  weightKg: number | null;
  tempoKgPerMin: number | null;
  weightFromStartKg: number | null;
  weightDeltaFromPreviousKg?: number | null;
  todayMacros: HomeStartTodayMacros;
  weekMacros: HomeStartWeekMacros;
}) {
  let weightHint: string | undefined;
  let weightTone: "muted" | "good" | "bad" = "muted";
  if (
    weightDeltaFromPreviousKg != null &&
    Number.isFinite(weightDeltaFromPreviousKg) &&
    Math.abs(weightDeltaFromPreviousKg) >= 0.05
  ) {
    const abs = formatKg(Math.abs(weightDeltaFromPreviousKg));
    const down = weightDeltaFromPreviousKg < 0;
    weightHint = `${down ? "↓" : "↑"} ${abs} kg od raportu`;
    weightTone = down ? "good" : "bad";
  } else if (weightFromStartKg != null && Number.isFinite(weightFromStartKg)) {
    weightHint = `${formatSignedKg(weightFromStartKg)} kg od startu`;
    weightTone = "muted";
  } else if (weightKg != null) {
    weightHint = "ostatni pomiar";
  }

  return (
    <section className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <MetricTile
          Icon={Scale}
          label="Waga"
          value={weightKg != null ? formatKg(weightKg) : "—"}
          unit="kg"
          hint={weightHint}
          hintTone={weightTone}
        />
        <MetricTile
          Icon={Activity}
          label="Tempo"
          value={tempoKgPerMin != null ? formatKg(tempoKgPerMin) : "—"}
          unit="kg/tydz"
          hint="z ostatniej sesji"
          hintTone="muted"
        />
        <MacroProgressTile title="Makro dziś" macros={todayMacros} />
        <MacroProgressTile title="Makro tydzień" macros={weekMacros} />
      </div>
    </section>
  );
}
