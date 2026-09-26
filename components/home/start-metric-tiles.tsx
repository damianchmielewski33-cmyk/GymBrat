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
    <div className="flex min-h-[118px] flex-col rounded-[18px] bg-[#161616] px-3.5 py-3.5">
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
  const pct =
    goal != null && goal > 0
      ? Math.min(100, Math.max(0, Math.round((consumed / goal) * 100)))
      : 0;
  const over = goal != null && consumed > goal;
  const leftLabel =
    remaining == null
      ? "brak celu"
      : remaining >= 0
        ? `${formatGrams(remaining)} g`
        : `+${formatGrams(Math.abs(remaining))} g`;

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/55">
          {label}
        </span>
        <span
          className={cn(
            "text-[11px] font-semibold tabular-nums",
            over ? "text-rose-400" : "text-white/90",
          )}
        >
          {leftLabel}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            over ? "bg-rose-400" : barClass,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MacroProgressTile({
  title,
  subtitle,
  macros,
}: {
  title: string;
  subtitle: string;
  macros: HomeStartTodayMacros | HomeStartWeekMacros;
}) {
  const hasGoals =
    macros.proteinGoal != null ||
    macros.carbsGoal != null ||
    macros.fatGoal != null;

  return (
    <div className="flex min-h-[118px] flex-col rounded-[18px] bg-[#161616] px-3.5 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
        {title}
      </p>
      <p className="mt-1 text-[10px] leading-snug text-white/40">{subtitle}</p>
      <div className="mt-2.5 flex flex-1 flex-col justify-center gap-2">
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
        <MacroProgressTile
          title="Makro dziś"
          subtitle="zostało do spożycia"
          macros={todayMacros}
        />
        <MacroProgressTile
          title="Makro tydzień"
          subtitle="zostało w tym tygodniu"
          macros={weekMacros}
        />
      </div>
    </section>
  );
}
