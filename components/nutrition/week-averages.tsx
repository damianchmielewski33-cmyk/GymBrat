import { ArrowDownRight, ArrowUpRight, Check, Minus } from "lucide-react";
import {
  formatPlNumber,
  type WeekAverage,
  type WeekInsight,
} from "@/lib/nutrition-day-balance";
import { cn } from "@/lib/utils";

function AvgRow({ a }: { a: WeekAverage }) {
  const pct = a.pct ?? 0;
  const scaleMax = Math.max(130, Math.min(200, Math.ceil(pct / 10) * 10));
  const fill = Math.min(pct, scaleMax);
  const goalAt = (100 / scaleMax) * 100;
  const Icon =
    a.status === "surplus"
      ? ArrowUpRight
      : a.status === "deficit"
        ? ArrowDownRight
        : a.status === "on_track"
          ? Check
          : Minus;
  const delta = a.avgDelta != null ? Math.round(a.avgDelta) : null;
  const text =
    a.avgGoal == null
      ? "brak celu"
      : a.status === "on_track"
        ? "w normie"
        : delta! > 0
          ? `+${formatPlNumber(delta!)} ${a.unit} dziennie`
          : `−${formatPlNumber(Math.abs(delta!))} ${a.unit} dziennie`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
          {a.label}
        </p>
        <p
          className={cn(
            "inline-flex items-center gap-1 text-[12px] font-semibold",
            a.status === "on_track" && "text-[var(--gym-trend-up)]",
            a.status === "surplus" && "text-white/90",
            a.status === "deficit" && "text-[var(--gym-gold)]",
            a.status === "no_goal" && "text-[var(--gym-text-secondary)]",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {text}
        </p>
      </div>
      <div
        role="img"
        aria-label={`${a.label}: średnio ${Math.round(a.avgConsumed)} ${a.unit} dziennie${a.avgGoal != null ? ` przy celu ${Math.round(a.avgGoal)}, ${a.pct} procent` : ""}`}
        className="relative h-2.5 overflow-hidden rounded-full bg-[var(--gym-track)]"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
            a.status === "on_track"
              ? "bg-[var(--gym-trend-up)]"
              : "bg-[var(--gym-gold)]",
          )}
          style={{ width: `${(fill / scaleMax) * 100}%` }}
        />
        {a.avgGoal != null ? (
          <span
            className="absolute top-0 h-full w-0.5 bg-white"
            style={{ left: `${goalAt}%` }}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="flex items-baseline justify-between text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
        <span>
          średnio{" "}
          <strong className="font-semibold text-white/90">
            {formatPlNumber(a.avgConsumed)}
          </strong>
          {a.avgGoal != null ? ` / ${formatPlNumber(a.avgGoal)}` : ""} {a.unit}
        </span>
        <span>
          {a.pct != null ? `${a.pct}% · ` : ""}
          {a.daysOk}✓ {a.daysOver}↑ {a.daysUnder}↓
        </span>
      </div>
    </div>
  );
}

/** Średnie dzienne vs cel + wnioski słowami. */
export function WeekAverages({
  averages,
  insights,
}: {
  averages: WeekAverage[];
  insights: WeekInsight[];
}) {
  const n = averages[0]?.daysCounted ?? 0;
  if (n === 0) {
    return (
      <p className="text-[13px] leading-snug text-[var(--gym-text-secondary)]">
        Średnie pojawią się, gdy skończy się pierwszy dzień z wpisami. Dziś w
        toku nie wchodzi do średniej, bo nie jest jeszcze kompletny.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {insights.length ? (
        <ul className="space-y-2">
          {insights.map((i) => (
            <li
              key={i.text}
              className={cn(
                "rounded-2xl border px-3 py-2.5 text-[13px] leading-snug",
                i.tone === "good" &&
                  "border-[color-mix(in_srgb,var(--gym-trend-up)_40%,transparent)] bg-[color-mix(in_srgb,var(--gym-trend-up)_8%,transparent)] text-white/90",
                i.tone === "warn" &&
                  "border-[var(--gym-border-gold)] bg-black/25 text-white/90",
                i.tone === "info" &&
                  "border-white/10 text-[var(--gym-text-secondary)]",
              )}
            >
              {i.text}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="space-y-3.5">
        {averages.map((a) => (
          <AvgRow key={a.key} a={a} />
        ))}
      </div>
      <p className="text-[11px] leading-snug text-[var(--gym-text-secondary)]">
        Średnia z {n} zamkniętych dni z wpisami (dziś w toku nie wlicza się).
        Biała kreska = cel dzienny. ✓ w normie · ↑ ponad cel · ↓ poniżej celu
        (liczba dni).
      </p>
    </div>
  );
}
