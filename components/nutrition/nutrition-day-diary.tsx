"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { loadNutritionDayLog } from "@/actions/nutrition-day-log";
import { EmptyNote } from "@/components/progress/progress-ui";
import { SectionLabel } from "@/components/ui/section-label";
import { DIET_DIARY_SLOTS, DIET_DIARY_SLOT_LABELS } from "@/lib/diet-diary-slots";
import type { MealLogDto } from "@/lib/meal-logs";
import { addCalendarDays } from "@/lib/local-date";
import { buildDayCardViewModel, formatPlNumber } from "@/lib/nutrition-day-balance";
import type { WeekDayNutritionRow } from "@/lib/week-nutrition-rows";
import { cn } from "@/lib/utils";

const STATUS_WORD = {
  surplus: "Ponad cel",
  deficit: "Brakuje",
  on_track: "W normie",
  no_goal: "Brak celu",
} as const;

function longDate(dateKey: string): string {
  try {
    const s = new Intl.DateTimeFormat("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(`${dateKey}T12:00:00`));
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return dateKey;
  }
}

function groupBySlot(entries: MealLogDto[]) {
  const groups: { key: string; name: string; items: MealLogDto[] }[] = [];
  for (const slot of DIET_DIARY_SLOTS) {
    const items = entries.filter((e) => e.slot === slot);
    if (items.length) {
      groups.push({ key: slot, name: DIET_DIARY_SLOT_LABELS[slot], items });
    }
  }
  const other = entries.filter((e) => e.slot == null);
  if (other.length) groups.push({ key: "other", name: "Inne", items: other });
  return groups;
}

export function NutritionDayDiary({
  dateKey,
  row,
  todayKey,
  minKey,
  onClose,
  onNavigate,
}: {
  dateKey: string;
  row: WeekDayNutritionRow | undefined;
  todayKey: string;
  /** Najstarszy załadowany dzień (granica strzałki „poprzedni”). */
  minKey: string;
  onClose: () => void;
  onNavigate: (dateKey: string) => void;
}) {
  const [state, setState] = useState<
    | { status: "loading"; key: string }
    | { status: "error"; key: string }
    | { status: "ready"; key: string; entries: MealLogDto[] }
  >({ status: "loading", key: dateKey });

  useEffect(() => {
    let cancelled = false;
    loadNutritionDayLog(dateKey)
      .then((res) => {
        if (cancelled) return;
        setState(
          res.ok
            ? { status: "ready", key: dateKey, entries: res.entries }
            : { status: "error", key: dateKey },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", key: dateKey });
      });
    return () => {
      cancelled = true;
    };
  }, [dateKey]);

  const view = state.key === dateKey ? state : { status: "loading" as const, key: dateKey };
  const readyEntries = view.status === "ready" ? view.entries : null;
  const groups = useMemo(
    () => (readyEntries ? groupBySlot(readyEntries) : []),
    [readyEntries],
  );
  const card = row ? buildDayCardViewModel(row, todayKey) : null;
  const kcal = card?.macros.find((m) => m.key === "calories") ?? null;
  const prevKey = addCalendarDays(dateKey, -1);
  const nextKey = addCalendarDays(dateKey, 1);
  const canPrev = prevKey >= minKey;
  const canNext = nextKey <= todayKey;

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 px-4 pb-10 sm:px-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Wróć do statystyk"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--gym-border-gold)] bg-black/25 text-white/90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
            Dziennik żywienia
          </p>
          <h1 className="font-heading text-[22px] font-semibold leading-tight text-white">
            {longDate(dateKey)}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Poprzedni dzień"
          disabled={!canPrev}
          onClick={() => onNavigate(prevKey)}
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gym-border-gold)] text-white",
            !canPrev && "opacity-35",
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="flex-1 text-center text-[14px] text-white/70">
          {card?.dayType === "training" ? "Dzień treningowy" : "Dzień bez treningu"}
        </p>
        <button
          type="button"
          aria-label="Następny dzień"
          disabled={!canNext}
          onClick={() => onNavigate(nextKey)}
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--gym-border-gold)] text-white",
            !canNext && "opacity-35",
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {card && kcal ? (
        <section className="app-card space-y-4 p-4 sm:p-5">
          <div>
            <p className="font-metric text-[34px] leading-none tabular-nums text-[var(--gym-gold)]">
              {formatPlNumber(kcal.consumed)}
              {kcal.goal != null ? (
                <span className="text-[16px] font-semibold text-white/85">
                  {" "}
                  / {formatPlNumber(kcal.goal)} kcal
                </span>
              ) : (
                <span className="text-[16px] font-semibold text-white/85"> kcal</span>
              )}
            </p>
            {kcal.delta != null ? (
              <p className="mt-1.5 text-[14px] font-semibold text-[var(--gym-gold-bright)]">
                {STATUS_WORD[kcal.status]}
                {kcal.status === "on_track" || kcal.delta === 0
                  ? ""
                  : ` ${formatPlNumber(Math.abs(kcal.delta))} kcal`}
              </p>
            ) : null}
          </div>
          <div className="space-y-3">
            {card.macros
              .filter((m) => m.key !== "calories")
              .map((m) => {
                const pct = m.goal ? Math.min(100, (m.consumed / m.goal) * 100) : 0;
                return (
                  <div key={m.key}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">
                        {m.label}
                      </span>
                      <span className="text-[14px] font-semibold tabular-nums text-white">
                        {formatPlNumber(m.consumed)}
                        {m.goal != null ? ` / ${formatPlNumber(m.goal)}` : ""} g
                        {m.delta != null && m.status !== "on_track" && m.status !== "no_goal"
                          ? ` · ${m.delta > 0 ? "+" : "−"}${formatPlNumber(Math.abs(m.delta))} g`
                          : ""}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 rounded-full bg-[var(--gym-track)]">
                      <div
                        className="h-2.5 rounded-full bg-[var(--gym-gold)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ) : null}

      <section className="space-y-3" aria-live="polite">
        <SectionLabel
          title={
            view.status === "ready"
              ? `Pełny dziennik · ${view.entries.length} ${view.entries.length === 1 ? "wpis" : "wpisów"}`
              : "Pełny dziennik"
          }
          titleAs="h2"
        />
        {view.status === "loading" ? (
          <EmptyNote>Wczytuję dziennik…</EmptyNote>
        ) : view.status === "error" ? (
          <EmptyNote>Nie udało się wczytać dziennika. Spróbuj ponownie później.</EmptyNote>
        ) : groups.length === 0 ? (
          <EmptyNote>Brak wpisów posiłków w tym dniu.</EmptyNote>
        ) : (
          groups.map((g) => {
            const sum = g.items.reduce((n, e) => n + e.calories, 0);
            return (
              <div key={g.key} className="app-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] px-4 py-3">
                  <h3 className="text-[15px] font-bold text-white">{g.name}</h3>
                  <span className="text-[14px] font-semibold tabular-nums text-[var(--gym-gold-bright)]">
                    {formatPlNumber(sum)} kcal
                  </span>
                </div>
                <ul>
                  {g.items.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start justify-between gap-3 border-t border-white/5 px-4 py-2.5 first:border-t-0"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] text-white">{e.name?.trim() || "Posiłek"}</p>
                        <p className="text-[13px] tabular-nums text-white/60">
                          B {formatPlNumber(e.proteinG)} · W {formatPlNumber(e.carbsG)} · T{" "}
                          {formatPlNumber(e.fatG)} g
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-[14px] font-semibold tabular-nums text-white">
                        {formatPlNumber(e.calories)} kcal
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
