"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  compareProgressWeekPicks,
  formatWeekCompareDelta,
  type ProgressWeekPick,
  type WeekTrainingCompare,
} from "@/lib/week-training-compare";
import { Explainer } from "@/components/progress/progress-ui";
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
        ? "bg-white/[0.06] text-[var(--gym-text-secondary)]"
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
    return <ArrowDownRight className="h-3.5 w-3.5 text-[var(--gym-text-secondary)]" aria-hidden />;
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

function weekOptionLabel(w: ProgressWeekPick): string {
  if (w.isCurrent) return `Ten tydzień · ${w.label}`;
  return w.label;
}

function WeekSelect({
  id,
  label,
  value,
  weeks,
  excludeMonday,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  weeks: ProgressWeekPick[];
  excludeMonday?: string;
  onChange: (monday: string) => void;
}) {
  return (
    <label className="block min-w-0 flex-1 space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-xl border border-white/[0.1] bg-black/40 px-3 text-[13px] font-medium text-white outline-none transition focus:border-[rgba(var(--neon-rgb),0.45)] focus:ring-1 focus:ring-[rgba(var(--neon-rgb),0.35)]"
      >
        {weeks.map((w) => (
          <option
            key={w.monday}
            value={w.monday}
            disabled={excludeMonday === w.monday}
            className="bg-[#121212] text-white"
          >
            {weekOptionLabel(w)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function WeekOverWeekCard({
  weeks,
  initialCompare,
}: {
  weeks: ProgressWeekPick[];
  /** Fallback SSR / gdy brak picków — stary payload. */
  initialCompare?: WeekTrainingCompare | null;
}) {
  const sorted = useMemo(
    () => [...weeks].sort((a, b) => b.monday.localeCompare(a.monday)),
    [weeks],
  );

  const defaultPrimary = sorted.find((w) => w.isCurrent)?.monday ?? sorted[0]?.monday;
  const defaultBaseline =
    sorted.find((w) => !w.isCurrent && w.monday !== defaultPrimary)?.monday ??
    sorted[1]?.monday ??
    sorted[0]?.monday;

  const [primaryMonday, setPrimaryMonday] = useState(defaultPrimary ?? "");
  const [baselineMonday, setBaselineMonday] = useState(defaultBaseline ?? "");

  const primary =
    sorted.find((w) => w.monday === primaryMonday) ?? sorted[0] ?? null;
  const baseline =
    sorted.find((w) => w.monday === baselineMonday) ??
    sorted.find((w) => w.monday !== primary?.monday) ??
    null;

  const compare = useMemo(() => {
    if (primary && baseline && primary.monday !== baseline.monday) {
      return compareProgressWeekPicks(primary, baseline);
    }
    return initialCompare ?? null;
  }, [primary, baseline, initialCompare]);

  if (!compare?.metrics?.length) return null;

  const alignedPartial = Boolean(primary?.isCurrent || baseline?.isCurrent);

  const setPrimary = (monday: string) => {
    setPrimaryMonday(monday);
    if (monday === baselineMonday) {
      const other = sorted.find((w) => w.monday !== monday);
      if (other) setBaselineMonday(other.monday);
    }
  };

  const setBaseline = (monday: string) => {
    setBaselineMonday(monday);
    if (monday === primaryMonday) {
      const other = sorted.find((w) => w.monday !== monday);
      if (other) setPrimaryMonday(other.monday);
    }
  };

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

      {sorted.length >= 2 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <WeekSelect
            id="week-compare-primary"
            label="Tydzień A"
            value={primary?.monday ?? ""}
            weeks={sorted}
            excludeMonday={baseline?.monday}
            onChange={setPrimary}
          />
          <WeekSelect
            id="week-compare-baseline"
            label="Tydzień B (odniesienie)"
            value={baseline?.monday ?? ""}
            weeks={sorted}
            excludeMonday={primary?.monday}
            onChange={setBaseline}
          />
        </div>
      ) : null}

      <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06]">
        {compare.metrics.map((m) => {
          const deltaTone =
            m.outcome === "progress"
              ? "text-emerald-300"
              : m.outcome === "regress"
                ? "text-[var(--gym-text-secondary)]"
                : "text-white/40";
          return (
            <li
              key={m.key}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-white/80">{m.label}</p>
                <p className="mt-0.5 text-[11px] text-white/35">
                  A {formatValue(m.current, m.unit, m.key)}
                  <span className="mx-1 text-white/20">·</span>
                  B {formatValue(m.previous, m.unit, m.key)}
                </p>
              </div>
              <p
                className={cn(
                  "inline-flex items-center gap-1 font-heading text-[13px] tabular-nums",
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

      <Explainer>
        <p>
          {alignedPartial
            ? "Gdy jeden tydzień to bieżący, oba zakresy są wyrównane do Pn→dziś, aby porównanie uwzględniało taką samą liczbę dni."
            : "Oba tygodnie liczone w pełnym zakresie Pn–Nd."}
        </p>
      </Explainer>
    </div>
  );
}
