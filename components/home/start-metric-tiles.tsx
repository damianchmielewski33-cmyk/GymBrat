import Link from "next/link";
import { Activity, ArrowRight, ArrowDown, ArrowUp, Scale, type LucideIcon } from "lucide-react";
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

function formatKcal(n: number): string {
  return String(Math.round(n));
}

type BadgeTone = "neutral" | "good" | "bad";

/** Plakietka ze zmianą / statusem (Waga, Tempo) — wspólny styl obu kafelków. */
function Badge({
  tone = "neutral",
  direction,
  children,
}: {
  tone?: BadgeTone;
  direction?: "up" | "down";
  children: string;
}) {
  const Arrow = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : null;
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold leading-none",
        tone === "bad" && "bg-rose-500/15 text-rose-400",
        tone === "good" && "bg-emerald-500/15 text-emerald-400",
        tone === "neutral" && "bg-white/[0.08] text-white/80",
      )}
    >
      {Arrow ? <Arrow className="h-3 w-3" strokeWidth={2.5} aria-hidden /> : null}
      {children}
    </span>
  );
}

function MetricTile({
  label,
  value,
  unit,
  badge,
  caption,
  Icon,
}: {
  label: string;
  value: string;
  unit?: string;
  badge?: { text: string; tone?: BadgeTone; direction?: "up" | "down" };
  caption?: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="app-card flex min-h-[132px] min-w-0 flex-col px-4 py-4">
      <div className="flex items-center gap-2">
        <Icon
          className="h-[18px] w-[18px] shrink-0 text-[var(--gym-gold)]"
          strokeWidth={1.75}
          aria-hidden
        />
        <p className="text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          {label}
        </p>
      </div>
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="font-metric text-[44px] leading-none tracking-wide text-white">
          {value}
        </span>
        {unit ? (
          <span className="font-heading text-[14px] font-medium text-white/60">
            {unit}
          </span>
        ) : null}
      </p>
      {badge || caption ? (
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 pt-3">
          {badge ? (
            <Badge tone={badge.tone} direction={badge.direction}>
              {badge.text}
            </Badge>
          ) : null}
          {caption ? (
            <span className="text-[12px] leading-snug text-white/60">
              {caption}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="mt-auto pt-3" />
      )}
    </div>
  );
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
    "app-card flex flex-col px-4 py-4 transition hover:bg-white/[0.02]";

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

  return <div className={cn(className, "col-span-2")}>{body}</div>;
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
  let weightBadge:
    | { text: string; tone?: BadgeTone; direction?: "up" | "down" }
    | undefined;
  let weightCaption: string | undefined;
  if (
    weightDeltaFromPreviousKg != null &&
    Number.isFinite(weightDeltaFromPreviousKg) &&
    Math.abs(weightDeltaFromPreviousKg) >= 0.05
  ) {
    const down = weightDeltaFromPreviousKg < 0;
    weightBadge = {
      text: `${formatSignedKg(weightDeltaFromPreviousKg)} kg`,
      tone: down ? "good" : "bad",
      direction: down ? "down" : "up",
    };
    weightCaption = "od ostatniego raportu";
  } else if (weightFromStartKg != null && Number.isFinite(weightFromStartKg)) {
    weightBadge = { text: `${formatSignedKg(weightFromStartKg)} kg`, tone: "neutral" };
    weightCaption = "od startu";
  } else if (weightKg != null) {
    weightBadge = { text: "Ostatni pomiar", tone: "neutral" };
  }

  return (
    <section className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <MetricTile
          Icon={Scale}
          label="Waga"
          value={weightKg != null ? formatKg(weightKg) : "—"}
          unit="kg"
          badge={weightBadge}
          caption={weightCaption}
        />
        <MetricTile
          Icon={Activity}
          label="Tempo"
          value={tempoKgPerMin != null ? formatKg(tempoKgPerMin) : "—"}
          unit="kg/tydz"
          badge={{ text: "Ostatnia sesja", tone: "neutral" }}
        />
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
