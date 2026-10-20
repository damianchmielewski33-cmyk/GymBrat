import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { WeekTrainingCompare } from "@/lib/week-training-compare";
import { formatWeekCompareDelta } from "@/lib/week-training-compare";
import { cn } from "@/lib/utils";

function VerdictBadge({
  verdict,
  label,
}: {
  verdict: WeekTrainingCompare["verdict"];
  label: string;
}) {
  const tone =
    verdict === "progress"
      ? "bg-emerald-400/15 text-emerald-300"
      : verdict === "regress"
        ? "bg-rose-400/15 text-rose-300"
        : verdict === "flat"
          ? "bg-white/[0.08] text-white/60"
          : "bg-white/[0.06] text-white/40";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function OutcomeIcon({
  outcome,
}: {
  outcome: "progress" | "regress" | "flat" | "none";
}) {
  if (outcome === "progress") {
    return (
      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
    );
  }
  if (outcome === "regress") {
    return <ArrowDownRight className="h-3.5 w-3.5 text-rose-300" aria-hidden />;
  }
  return <Minus className="h-3.5 w-3.5 text-white/35" aria-hidden />;
}

function formatValue(
  value: number | null,
  unit: string,
  key: string,
): string {
  if (value == null) return "—";
  if (key === "tonnageKg") {
    return `${value.toLocaleString("pl-PL", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} t`;
  }
  if (key === "cardioMinutes") return `${Math.round(value)} min`;
  if (key === "workouts") return String(Math.round(value));
  return value.toLocaleString("pl-PL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function WeekOverWeekCard({
  compare,
}: {
  compare: WeekTrainingCompare;
}) {
  if (!compare?.metrics?.length) return null;

  return (
    <div className="space-y-3 app-panel px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white/90">
            Porównanie tygodni
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/40">
            {compare.thisRangeLabel}
            <span className="mx-1 text-white/25">·</span>
            {compare.prevRangeLabel}
          </p>
        </div>
        <VerdictBadge verdict={compare.verdict} label={compare.verdictLabel} />
      </div>

      <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06]">
        {compare.metrics.map((m) => {
          const deltaTone =
            m.outcome === "progress"
              ? "text-emerald-300"
              : m.outcome === "regress"
                ? "text-rose-300"
                : "text-white/40";
          return (
            <li
              key={m.key}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-white/80">{m.label}</p>
                <p className="mt-0.5 text-[11px] text-white/35">
                  teraz {formatValue(m.current, m.unit, m.key)}
                  <span className="mx-1 text-white/20">·</span>
                  poprz. {formatValue(m.previous, m.unit, m.key)}
                </p>
              </div>
              <p
                className={cn(
                  "inline-flex items-center gap-1 font-metric text-[13px] tabular-nums",
                  deltaTone,
                )}
              >
                <OutcomeIcon outcome={m.outcome} />
                {formatWeekCompareDelta(m)}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] leading-snug text-white/35">
        Porównanie do tych samych dni poprzedniego tygodnia (Pn→dziś), żeby
        środek tygodnia nie wyglądał jak regres względem pełnego Pn–Nd.
      </p>
    </div>
  );
}
