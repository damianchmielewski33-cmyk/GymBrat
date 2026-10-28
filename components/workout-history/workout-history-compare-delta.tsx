"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { WorkoutHistoryCard } from "@/lib/workout-history-overview";
import { formatHistoryShortDate } from "@/lib/workout-history-overview";

function formatDeltaPercent(pct: number): string {
  const abs = Math.abs(pct);
  const formatted = new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 1,
    minimumFractionDigits: abs < 10 && abs !== Math.floor(abs) ? 1 : 0,
  }).format(abs);
  if (pct > 0) return `+${formatted}%`;
  if (pct < 0) return `−${formatted}%`;
  return "0%";
}

function formatDeltaKg(kg: number): string {
  const abs = Math.round(Math.abs(kg));
  const formatted = new Intl.NumberFormat("pl-PL", {
    maximumFractionDigits: 0,
  }).format(abs);
  if (kg > 0) return `+${formatted} kg`;
  if (kg < 0) return `−${formatted} kg`;
  return "0 kg";
}

/** Pastylka porównania na zwiniętej karcie. */
export function WorkoutHistoryCompareChip({ card }: { card: WorkoutHistoryCard }) {
  if (card.noComparison) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 text-[12px] leading-4 text-[var(--gym-text-secondary)]">
        Pierwszy w planie
      </span>
    );
  }

  if (card.volumeDeltaPercent == null && card.volumeDeltaKg == null) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 text-[12px] leading-4 text-[var(--gym-text-secondary)]">
        <Minus className="h-3.5 w-3.5" aria-hidden />
        bez porównania
      </span>
    );
  }

  const pct = card.volumeDeltaPercent ?? 0;
  const prev = card.prevDate ? formatHistoryShortDate(card.prevDate) : null;
  const label = prev
    ? `${pct === 0 ? "bez zmiany" : formatDeltaPercent(pct)} · ${prev}`
    : pct === 0
      ? "bez zmiany"
      : formatDeltaPercent(pct);

  if (pct > 0) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 text-[12px] leading-4 text-white">
        <TrendingUp
          className="h-3.5 w-3.5 text-[var(--gym-success)]"
          aria-hidden
        />
        {label}
      </span>
    );
  }
  if (pct < 0) {
    return (
      <span className="mt-1 inline-flex items-center gap-1 text-[12px] leading-4 text-[var(--gym-text-secondary)]">
        <TrendingDown className="h-3.5 w-3.5" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-[12px] leading-4 text-[var(--gym-text-secondary)]">
      <Minus className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

/** Blok „Względem …” w rozwinięciu karty. */
export function WorkoutHistoryCompareBlock({ card }: { card: WorkoutHistoryCard }) {
  if (card.noComparison) {
    return (
      <p className="text-[13px] leading-5 text-[var(--gym-text-secondary)]">
        Pierwszy trening z tego planu. Porównanie pojawi się przy następnym.
      </p>
    );
  }

  const prev = card.prevDate ? formatHistoryShortDate(card.prevDate) : "—";
  const pct = card.volumeDeltaPercent;
  const kg = card.volumeDeltaKg;
  const hasBodyweight = card.exercises.some((ex) => ex.isBodyweight);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[var(--gym-surface)] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
        Względem {prev}
        {card.planLabel ? ` · ${card.planLabel}` : ""}
      </p>
      {kg != null ? (
        <p className="mt-1.5 text-[14px] leading-5 text-white/85">
          Tonaż{" "}
          <b className="font-semibold tabular-nums text-white">
            {formatDeltaKg(kg)}
          </b>
          {pct != null ? (
            <>
              {" "}
              (
              <b className="font-semibold tabular-nums text-white">
                {formatDeltaPercent(pct)}
              </b>
              )
            </>
          ) : null}
        </p>
      ) : null}
      {card.compare ? (
        <p className="mt-1 text-[14px] leading-5 text-white/85">
          Ćwiczenia:{" "}
          <b className="font-semibold tabular-nums text-white">{card.compare.up}</b> w
          górę ·{" "}
          <b className="font-semibold tabular-nums text-white">{card.compare.down}</b>{" "}
          w dół ·{" "}
          <b className="font-semibold tabular-nums text-white">{card.compare.same}</b>{" "}
          bez zmian
        </p>
      ) : null}
      {hasBodyweight ? (
        <p className="mt-2 text-[12px] leading-4 text-[var(--gym-text-secondary)]">
          Ćwiczenia bez ciężaru nie wliczają się do porównania.
        </p>
      ) : null}
    </div>
  );
}

export function compareChipAriaText(card: WorkoutHistoryCard): string {
  if (card.noComparison) return "pierwszy trening z tego planu";
  if (card.volumeDeltaPercent == null) return "bez porównania";
  const prev = card.prevDate ? formatHistoryShortDate(card.prevDate) : "";
  const pct = formatDeltaPercent(card.volumeDeltaPercent);
  if (card.volumeDeltaPercent === 0) {
    return prev ? `bez zmiany względem ${prev}` : "bez zmiany";
  }
  return prev ? `${pct} względem ${prev}` : pct;
}
