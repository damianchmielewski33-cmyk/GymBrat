"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Play,
  Watch,
} from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { CardioLogSheet } from "@/components/treningi/cardio-log-sheet";
import { formatPace } from "@/lib/cardio-utils";
import type { CardioHubData } from "@/lib/cardio-hub-shared";
import {
  formatCardioDurationClock,
  formatCardioRelativeDay,
} from "@/lib/cardio-hub-shared";
import {
  CARDIO_WEEKDAY_SHORT,
  compareDaysThrough,
  compareWeeksThrough,
  formatSignedMinutes,
  formatSignedPct,
  throughDayIndexForToday,
} from "@/lib/cardio-week-stats";
import { cn } from "@/lib/utils";
import { MiniSparkline } from "@/components/home/mini-sparkline";

function formatWeekFrom(monday: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${monday}T12:00:00`));
  } catch {
    return monday;
  }
}

function formatDayMonth(ymd: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(`${ymd}T12:00:00`));
  } catch {
    return ymd;
  }
}

function wejscLabel(n: number): string {
  if (n === 1) return "1 wejście w tym tygodniu";
  if (n >= 2 && n <= 4) return `${n} wejścia w tym tygodniu`;
  return `${n} wejść w tym tygodniu`;
}

export function CardioHubView({ data }: { data: CardioHubData }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetHint, setSheetHint] = useState<"manual" | "watch">("manual");
  /** 1 = zeszły tydzień, 2 = dwa tygodnie wstecz… */
  const [compareWeekIndex, setCompareWeekIndex] = useState(1);
  const today = data.todayKey;

  const currentWeek = data.last8[0] ?? null;
  const maxCompare = Math.max(1, data.last8.length - 1);
  const compareWeek =
    compareWeekIndex > 0 && compareWeekIndex < data.last8.length
      ? (data.last8[compareWeekIndex] ?? null)
      : null;

  const throughIdx = useMemo(
    () => throughDayIndexForToday(data.weekMonday, today),
    [data.weekMonday, today],
  );

  const weekCompare = useMemo(() => {
    if (!currentWeek) return null;
    const prev = data.last8[1] ?? null;
    return compareWeeksThrough(currentWeek, prev, throughIdx, data.goalMinutes);
  }, [currentWeek, data.last8, data.goalMinutes, throughIdx]);

  const dayCompare = useMemo(() => {
    if (!currentWeek) return [];
    return compareDaysThrough(currentWeek, compareWeek, throughIdx);
  }, [currentWeek, compareWeek, throughIdx]);

  const dayMax = useMemo(() => {
    let max = 1;
    for (const w of data.last8) {
      for (const m of w.dayMinutes) max = Math.max(max, m);
    }
    return max;
  }, [data.last8]);

  function openAdd(kind: "manual" | "watch") {
    setSheetHint(kind);
    setSheetOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-white/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć
      </Link>

      <header className="flex items-start justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Tydzień od {formatWeekFrom(data.weekMonday)}
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-white">
            Cardio
          </h1>
          <p className="mt-1.5 text-[13px] text-white/45">
            {wejscLabel(data.entriesThisWeek)}
          </p>
        </div>
        <div className="shrink-0 pt-1 text-right">
          <p className="flex items-baseline justify-end gap-1.5">
            <AnimatedMetric
              value={data.minutesThisWeek}
              className="text-[2.75rem] leading-none text-white"
            />
            <span className="font-metric text-lg text-white/55">min</span>
          </p>
          <p className="mt-1 text-[11px] text-white/40">w tym tygodniu</p>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-[var(--gym-gold)]/35 bg-[var(--gym-surface-sunken)] p-4 shadow-[0_0_36px_rgba(235,196,74,0.12)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "linear-gradient(145deg, rgba(235,196,74,0.22) 0%, rgba(40,28,8,0.4) 48%, transparent 75%)",
          }}
          aria-hidden
        />
        <div className="relative space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Zalecenie Damiana
            </p>
            <p className="mt-1 font-metric text-[2rem] leading-none text-white">
              {data.goalMinutes}
              <span className="ml-1 text-base text-white/45">min</span>
            </p>
          </div>

          <Link
            href="/cardio/record"
            className="gold-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden />
            Nagraj trasę
          </Link>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => openAdd("manual")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/25 text-[13px] font-semibold text-white/85"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Dodaj wpis
            </button>
            <button
              type="button"
              onClick={() => openAdd("watch")}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/25 text-[13px] font-semibold text-white/85"
            >
              <Watch className="h-3.5 w-3.5" aria-hidden />
              Z zegarka
            </button>
          </div>
          {sheetHint === "watch" && sheetOpen ? (
            <p className="text-[11px] text-white/40">
              Wpisz wynik z zegarka — na następnym ekranie możesz dodać zdjęcie
              ekranu.
            </p>
          ) : null}
        </div>
      </section>

      <section className="app-card space-y-3 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
          Ten tydzień · metryki
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricTile
            label="Dystans"
            value={
              data.distanceKmThisWeek > 0
                ? data.distanceKmThisWeek.toLocaleString("pl-PL", {
                    maximumFractionDigits: 1,
                  })
                : "—"
            }
            hint="km"
          />
          <MetricTile
            label="Kalorie"
            value={
              data.caloriesThisWeek > 0
                ? String(data.caloriesThisWeek)
                : "—"
            }
            hint="kcal"
          />
          <MetricTile
            label="Kroki"
            value={
              data.stepsThisWeek > 0
                ? data.stepsThisWeek.toLocaleString("pl-PL")
                : "—"
            }
          />
          <MetricTile
            label="Tempo"
            value={formatPace(data.avgPaceMinPerKmThisWeek)}
            hint="/km"
          />
        </div>
        {data.last8.some((w) => w.minutes > 0) ? (
          <div className="space-y-2 border-t border-white/[0.06] pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-white/45">Minuty · 8 tyg.</p>
              <div className="w-28">
                <MiniSparkline
                  values={[...data.last8].reverse().map((w) => w.minutes)}
                  color="#ebc44a"
                  className="h-7 w-full"
                />
              </div>
            </div>
            {data.last8.some((w) => w.distanceKm > 0) ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/45">Dystans · 8 tyg.</p>
                <div className="w-28">
                  <MiniSparkline
                    values={[...data.last8].reverse().map((w) => w.distanceKm)}
                    color="#38bdf8"
                    className="h-7 w-full"
                  />
                </div>
              </div>
            ) : null}
            {data.last8.some((w) => w.calories > 0) ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-white/45">Kalorie · 8 tyg.</p>
                <div className="w-28">
                  <MiniSparkline
                    values={[...data.last8].reverse().map((w) => w.calories)}
                    color="#fb7185"
                    className="h-7 w-full"
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {weekCompare ? (
        <section className="app-card space-y-3.5 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
              Vs zeszły tydzień
            </p>
            <p className="mt-1 text-[13px] text-white/50">
              Pn→dziś · ten sam okres w poprzednim tygodniu
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
                Minuty
              </p>
              <p
                className={cn(
                  "mt-1 font-display text-[26px] leading-none tabular-nums",
                  weekCompare.deltaMinutes > 0
                    ? "text-emerald-300"
                    : weekCompare.deltaMinutes < 0
                      ? "text-rose-300"
                      : "text-white/45",
                )}
              >
                {formatSignedMinutes(weekCompare.deltaMinutes)}
              </p>
              <p className="mt-1.5 text-[11px] tabular-nums text-white/40">
                {weekCompare.currentMinutes} · poprz.{" "}
                {weekCompare.previousMinutes}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
                Zmiana
              </p>
              <p
                className={cn(
                  "mt-1 font-display text-[26px] leading-none tabular-nums",
                  (weekCompare.deltaPct ?? 0) > 0
                    ? "text-emerald-300"
                    : (weekCompare.deltaPct ?? 0) < 0
                      ? "text-rose-300"
                      : "text-white/45",
                )}
              >
                {formatSignedPct(weekCompare.deltaPct)}
              </p>
              <p className="mt-1.5 text-[11px] tabular-nums text-white/40">
                cel {weekCompare.currentGoalPct != null
                  ? `${weekCompare.currentGoalPct}%`
                  : "—"}
                {" · "}
                poprz.{" "}
                {weekCompare.previousGoalPct != null
                  ? `${weekCompare.previousGoalPct}%`
                  : "—"}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {currentWeek ? (
        <section className="app-card space-y-3.5 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
              Dzień do dnia
            </p>
            <p className="mt-1 text-[13px] text-white/50">
              Minuty w tym tygodniu vs wybrany tydzień wstecz
            </p>
          </div>

          {compareWeek ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 px-2 py-2">
              <button
                type="button"
                aria-label="Starszy tydzień"
                disabled={compareWeekIndex >= maxCompare}
                onClick={() =>
                  setCompareWeekIndex((i) => Math.min(maxCompare, i + 1))
                }
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80",
                  compareWeekIndex >= maxCompare && "opacity-30",
                )}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">
                  Porównaj z
                </p>
                <p className="truncate text-[13px] font-semibold text-white">
                  {compareWeek.label}
                </p>
              </div>
              <button
                type="button"
                aria-label="Nowszy tydzień"
                disabled={compareWeekIndex <= 1}
                onClick={() => setCompareWeekIndex((i) => Math.max(1, i - 1))}
                className={cn(
                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white/80",
                  compareWeekIndex <= 1 && "opacity-30",
                )}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          ) : null}

          <div className="space-y-2.5">
            {dayCompare.map((row) => {
              const curH = Math.round((row.currentMinutes / dayMax) * 100);
              const prevH = Math.round((row.previousMinutes / dayMax) * 100);
              return (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "w-8 text-[12px] font-semibold",
                        row.future ? "text-white/30" : "text-white/70",
                      )}
                    >
                      {row.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-white/45">
                      {row.future ? (
                        "—"
                      ) : (
                        <>
                          {row.currentMinutes} min
                          <span className="text-white/30">
                            {" "}
                            · poprz. {row.previousMinutes}
                          </span>
                        </>
                      )}
                    </span>
                    <span
                      className={cn(
                        "min-w-[4.5rem] text-right text-[12px] font-semibold tabular-nums",
                        row.future
                          ? "text-white/25"
                          : row.deltaMinutes > 0
                            ? "text-emerald-300"
                            : row.deltaMinutes < 0
                              ? "text-rose-300"
                              : "text-white/40",
                      )}
                    >
                      {row.future
                        ? "—"
                        : `${formatSignedMinutes(row.deltaMinutes).replace(" min", "")} · ${formatSignedPct(row.deltaPct)}`}
                    </span>
                  </div>
                  <div className="flex h-2 gap-1">
                    <div className="relative h-full flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full",
                          row.future
                            ? "bg-white/10"
                            : "bg-gradient-to-r from-[var(--gym-gold-deep)] to-[var(--gym-gold)]",
                        )}
                        style={{ width: `${row.future ? 0 : curH}%` }}
                      />
                    </div>
                    <div className="relative h-full flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-sky-400/70"
                        style={{ width: `${prevH}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-white/40">
            Złoty pasek — ten tydzień · niebieski — wybrany tydzień
          </p>
        </section>
      ) : null}

      {data.last8.some((w) => w.minutes > 0) ? (
        <section className="app-card space-y-3 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
              Tygodnie · dni
            </p>
            <p className="mt-1 text-[13px] text-white/50">
              Minuty pn–nd w ostatnich 8 tygodniach
            </p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[18rem]">
              <div className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
                <span />
                {CARDIO_WEEKDAY_SHORT.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="mt-1.5 space-y-1">
                {data.last8.map((w, wi) => (
                  <div
                    key={w.monday}
                    className="grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] items-center gap-1"
                  >
                    <span
                      className={cn(
                        "truncate text-[10px] tabular-nums",
                        wi === 0 ? "text-[var(--gym-gold)]" : "text-white/40",
                      )}
                    >
                      {wi === 0 ? "Teraz" : w.label.split("–")[0]}
                    </span>
                    {w.dayMinutes.map((m, di) => {
                      const intensity =
                        m <= 0 ? 0 : Math.max(0.18, Math.min(1, m / dayMax));
                      const future =
                        wi === 0 && di > throughIdx;
                      return (
                        <div
                          key={`${w.monday}-${di}`}
                          title={`${CARDIO_WEEKDAY_SHORT[di]}: ${m} min`}
                          className={cn(
                            "flex h-8 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums",
                            future
                              ? "bg-white/[0.03] text-white/20"
                              : m <= 0
                                ? "bg-white/[0.04] text-white/25"
                                : "text-black",
                          )}
                          style={
                            !future && m > 0
                              ? {
                                  backgroundColor: `rgba(235, 196, 74, ${intensity.toFixed(2)})`,
                                }
                              : undefined
                          }
                        >
                          {future ? "·" : m > 0 ? m : "—"}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-2.5">
        <SectionLabel
          index={1}
          title="Historia"
          trailing={`${data.historyTotal}`}
          titleTone="white"
        />

        {data.items.length === 0 ? (
          <div className="app-panel px-4 py-10 text-center text-sm text-white/45">
            Brak wpisów cardio — nagraj trasę albo dodaj wpis ręcznie.
          </div>
        ) : (
          <ul className="overflow-hidden app-panel divide-y divide-white/[0.06]">
            {data.items.map((item) => {
              const href =
                item.kind === "cardio_log"
                  ? `/cardio/${item.id}`
                  : `/workout-history/${item.id}`;
              const meta = [
                item.distanceKm != null
                  ? `${item.distanceKm.toLocaleString("pl-PL", {
                      maximumFractionDigits: 1,
                    })} km`
                  : null,
                item.paceMinPerKm != null
                  ? `${formatPace(item.paceMinPerKm)} /km`
                  : null,
                item.calories != null ? `${item.calories} kcal` : null,
                item.steps != null
                  ? `${item.steps.toLocaleString("pl-PL")} krok.`
                  : null,
                item.avgHr != null ? `${item.avgHr} bpm` : null,
                formatCardioRelativeDay(item.date, today),
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <li key={item.id}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.02]"
                  >
                    <span className="w-11 shrink-0 text-[12px] tabular-nums text-white/40">
                      {formatDayMonth(item.date)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-white">
                        {item.title} · {formatCardioDurationClock(item.minutes)}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-white/40">
                        {meta || "—"}
                      </span>
                    </span>
                    <Pencil
                      className="h-3.5 w-3.5 shrink-0 text-white/35"
                      aria-hidden
                    />
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-white/30"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CardioLogSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        cardioGoalMinutes={data.goalMinutes}
        defaultTitle={sheetHint === "watch" ? "Zegarek" : "Marsz"}
      />
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2.5 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
        {label}
      </p>
      <p className="mt-1 font-metric text-lg tabular-nums text-white">
        {value}
        {hint && value !== "—" ? (
          <span className="ml-0.5 text-[11px] text-white/35">{hint}</span>
        ) : null}
      </p>
    </div>
  );
}
