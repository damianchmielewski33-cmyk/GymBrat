"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, HeartPulse, TrendingDown, TrendingUp } from "lucide-react";
import type {
  WorkoutHistoryCard,
  WorkoutHistoryCardioItem,
  WorkoutHistoryOverview,
} from "@/lib/workout-history-overview";
import {
  formatHistoryShortDate,
  formatTonnes,
} from "@/lib/workout-history-overview";
import {
  formatProgressDelta,
  progressDeltaTone,
  type ProgressDeltaUnit,
} from "@/lib/progress-delta-unit";
import { cn } from "@/lib/utils";
import { AppPageHeader } from "@/components/layout/screen";

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="app-card p-3.5 text-center sm:p-4">
      <p className="app-label">{label}</p>
      <p className="mt-2 font-display text-[1.85rem] leading-none tabular-nums text-[var(--gym-gold)] sm:text-3xl">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] text-white/45">{sub}</p>
    </div>
  );
}

function WorkoutCardRow({
  card,
  progressDeltaUnit,
}: {
  card: WorkoutHistoryCard;
  progressDeltaUnit: ProgressDeltaUnit;
}) {
  const [open, setOpen] = useState(false);
  const volumeLabel = formatTonnes(card.volumeKg);
  const dateLabel = formatHistoryShortDate(card.date);
  const prevLabel = card.prevDate ? formatHistoryShortDate(card.prevDate) : null;
  const volLabel = formatProgressDelta({
    unit: progressDeltaUnit,
    percent: card.volumeDeltaPercent,
    absolute: card.volumeDeltaKg,
    absoluteUnit: "kg",
  });
  const tone = progressDeltaTone(
    progressDeltaUnit,
    card.volumeDeltaPercent,
    card.volumeDeltaKg,
  );
  const volDown = tone === "down";
  const volUp = tone === "up";

  let metaLeft: ReactNode;
  if (card.noComparison) {
    metaLeft = (
      <p className="text-[12px] leading-snug text-white/45">
        {card.firstOfDay ? "pierwszy trening tego dnia, " : ""}
        {dateLabel}, brak porównania w planie {card.planLabel}
      </p>
    );
  } else {
    metaLeft = (
      <div className="space-y-1">
        <p className="inline-flex flex-wrap items-center gap-1.5 text-[12px] text-white/50">
          <span className="text-white/35">{card.planLabel}</span>
          <span>
            {prevLabel} → {dateLabel}
          </span>
          {volDown ? (
            <TrendingDown className="h-3.5 w-3.5 text-red-400" aria-hidden />
          ) : volUp ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
          ) : null}
        </p>
        {card.compare ? (
          <p className="text-[12px] leading-snug">
            <span className="text-emerald-400">{card.compare.up} w górę</span>
            <span className="text-white/35">, </span>
            <span className="text-red-400">{card.compare.down} w dół</span>
            <span className="text-white/35">, </span>
            <span className="text-white/70">
              {card.compare.skipped} pominiętych
            </span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="app-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[15px] font-semibold text-white">{card.title}</p>
          {metaLeft}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-xl tabular-nums text-[var(--gym-gold)] sm:text-2xl">
            {volumeLabel}
          </p>
          {!card.noComparison && volLabel != null ? (
            <p
              className={cn(
                "mt-0.5 text-[11px] font-medium tabular-nums",
                volDown
                  ? "text-red-400"
                  : volUp
                    ? "text-emerald-400"
                    : "text-white/45",
              )}
            >
              {volLabel} objętości
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-white/40 transition",
            open && "rotate-180",
          )}
        />
      </button>
      {open ? (
        <div className="border-t border-white/[0.06] px-4 py-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
            <span>
              Ćwiczenia: <span className="text-white/80">{card.exerciseCount}</span>
            </span>
            <span>
              Serie:{" "}
              <span className="text-white/80">
                {card.setsDone}/{card.setsTotal}
              </span>
            </span>
            {card.planName ? (
              <span>
                Plan: <span className="text-white/80">{card.planName}</span>
              </span>
            ) : null}
            {card.cardioMinutes > 0 ? (
              <span className="inline-flex items-center gap-1">
                <HeartPulse className="h-3.5 w-3.5 text-[var(--gym-gold)]/80" aria-hidden />
                Cardio:{" "}
                <span className="text-white/80 tabular-nums">{card.cardioMinutes} min</span>
              </span>
            ) : null}
          </div>
          <Link
            href={`/workout-history/${card.id}`}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-xl border border-[rgba(var(--neon-rgb),0.4)] px-4 text-sm font-medium text-[var(--gym-gold)]"
          >
            Szczegóły serii
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function CardioRow({ item }: { item: WorkoutHistoryCardioItem }) {
  return (
    <div className="app-card flex items-center justify-between px-4 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{item.title}</p>
        <p className="mt-0.5 text-xs text-white/45">
          {formatHistoryShortDate(item.date)}
          {item.avgHr != null ? ` · ${item.avgHr} bpm` : ""}
        </p>
      </div>
      <p className="font-display text-lg tabular-nums text-[var(--gym-gold)]">
        {item.minutes} min
      </p>
    </div>
  );
}

type Props = {
  overview: WorkoutHistoryOverview;
  progressDeltaUnit?: ProgressDeltaUnit;
};

export function WorkoutHistoryView({
  overview,
  progressDeltaUnit = "percent",
}: Props) {
  const { kpis, cards, cardio, planFilters } = overview;
  const [filterPlanKey, setFilterPlanKey] = useState<string | "all">("all");
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(() => {
    if (filterPlanKey === "all") return cards;
    return cards.filter((c) => c.planCompareKey === filterPlanKey);
  }, [cards, filterPlanKey]);

  const scopedKpis = useMemo(() => {
    const hit =
      filterPlanKey === "all"
        ? null
        : planFilters.find((p) => p.id === filterPlanKey) ?? null;
    if (filterPlanKey === "all") {
      return { ...kpis, planFilterLabel: null as string | null };
    }
    const since = (() => {
      try {
        const d = new Date();
        d.setDate(d.getDate() - 29);
        return d.toISOString().slice(0, 10);
      } catch {
        return "1970-01-01";
      }
    })();
    let workoutsLast30 = 0;
    let tonnageLast30Kg = 0;
    for (const c of filtered) {
      if (c.date >= since) {
        workoutsLast30 += 1;
        tonnageLast30Kg += c.volumeKg;
      }
    }
    return {
      ...kpis,
      workoutsLast30,
      tonnageLast30Kg,
      workoutsTotal: filtered.length,
      planDaysActive: filtered.length > 0 ? 1 : 0,
      planDaysTotal: 1,
      lastWorkoutDate: filtered[0]?.date ?? null,
      planFilterLabel: hit?.label ?? null,
    };
  }, [filterPlanKey, filtered, kpis, planFilters]);

  const filterLabel =
    filterPlanKey === "all"
      ? `Wszystkie treningi · ${cards.length}`
      : (() => {
          const hit = planFilters.find((p) => p.id === filterPlanKey);
          return hit ? `${hit.label} · ${hit.count}` : "Filtr";
        })();

  const trenLabel =
    filterPlanKey === "all"
      ? "Treningów / 30 dni"
      : `Treningów ${scopedKpis.planFilterLabel ?? ""} / 30 dni`.replace(/\s+/g, " ").trim();

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <AppPageHeader
        kicker="Treningi"
        title="Historia"
        description="Porównania tylko w obrębie tego samego dnia planu (np. Nogi → Nogi)."
      />

      <div className="grid grid-cols-2 gap-2.5">
        <KpiCard
          label={trenLabel}
          value={String(scopedKpis.workoutsLast30)}
          sub={formatTonnes(scopedKpis.tonnageLast30Kg)}
        />
        <KpiCard
          label="Cardio / 30 dni"
          value={`${kpis.cardioMinutesLast30} min`}
          sub={`${kpis.cardioEntriesLast30} ${
            kpis.cardioEntriesLast30 === 1 ? "wejście" : "wejść"
          }`}
        />
        <KpiCard
          label="Dni planu w ruchu"
          value={String(scopedKpis.planDaysActive)}
          sub={
            filterPlanKey === "all"
              ? `z ${scopedKpis.planDaysTotal} w planie`
              : scopedKpis.planFilterLabel
                ? `tylko ${scopedKpis.planFilterLabel}`
                : "wybrany plan"
          }
        />
        <KpiCard
          label="Treningów łącznie"
          value={String(scopedKpis.workoutsTotal)}
          sub={
            scopedKpis.lastWorkoutDate
              ? `ostatni ${formatHistoryShortDate(scopedKpis.lastWorkoutDate)}`
              : "brak sesji"
          }
        />
      </div>

      <section className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="app-card px-4 py-10 text-center text-sm text-white/50">
            Brak zakończonych treningów — ukończ pierwszą sesję, żeby zobaczyć historię.
          </div>
        ) : (
          filtered.map((card) => (
            <WorkoutCardRow
              key={card.id}
              card={card}
              progressDeltaUnit={progressDeltaUnit}
            />
          ))
        )}
      </section>

      <div className="relative">
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className="app-card flex h-12 w-full items-center justify-between px-4 text-left text-[12px] font-semibold uppercase tracking-[0.12em] text-white/80"
        >
          <span className="truncate">{filterLabel}</span>
          <ChevronDown
            className={cn("h-4 w-4 text-white/40 transition", filterOpen && "rotate-180")}
          />
        </button>
        {filterOpen ? (
          <ul className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#101010] py-1 shadow-xl">
            <li>
              <button
                type="button"
                className="flex w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/[0.06]"
                onClick={() => {
                  setFilterPlanKey("all");
                  setFilterOpen(false);
                }}
              >
                Wszystkie treningi · {cards.length}
              </button>
            </li>
            {planFilters.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/[0.06]"
                  onClick={() => {
                    setFilterPlanKey(p.id);
                    setFilterOpen(false);
                  }}
                >
                  {p.label} · {p.count}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <section className="space-y-2.5">
        <div className="flex items-center gap-2 px-0.5">
          <HeartPulse className="h-4 w-4 text-[var(--gym-gold)]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
            Cardio
          </h2>
        </div>
        {cardio.length === 0 ? (
          <p className="text-sm text-white/40">Brak wpisów cardio.</p>
        ) : (
          cardio.map((c) => <CardioRow key={c.id} item={c} />)
        )}
      </section>
    </div>
  );
}

