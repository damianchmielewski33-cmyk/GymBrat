"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Play,
  Watch,
} from "lucide-react";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { SectionLabel } from "@/components/ui/section-label";
import { CardioLogSheet } from "@/components/treningi/cardio-log-sheet";
import type { CardioHubData } from "@/lib/cardio-hub";
import {
  formatCardioDurationClock,
  formatCardioRelativeDay,
} from "@/lib/cardio-hub";
import { calendarDateKey } from "@/lib/local-date";

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
  const today = calendarDateKey();

  function openAdd(kind: "manual" | "watch") {
    setSheetHint(kind);
    setSheetOpen(true);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <Link
        href="/workout-plan"
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
