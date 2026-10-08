"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ChevronDown, Pencil } from "lucide-react";
import { deleteCompletedWorkout } from "@/actions/workout-history";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import type {
  WorkoutHistoryCard,
  WorkoutHistoryOverview,
} from "@/lib/workout-history-overview";
import {
  canEditWorkout,
  formatEditDeadline,
  formatHistoryDayChip,
  formatHistoryKg,
  formatHistoryWeekRange,
  formatSetsLabel,
  formatTonnes,
  workoutEditDeadlineMs,
} from "@/lib/workout-history-overview";
import { addCalendarDays, calendarWeekdaySun0 } from "@/lib/local-date";
import { AnimatedMetric } from "@/components/ui/animated-metric";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 520;

function mondayOfWeek(dateKey: string): string {
  const dow = calendarWeekdaySun0(dateKey);
  const offset = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateKey, offset);
}

type WeekGroup = {
  monday: string;
  cards: WorkoutHistoryCard[];
  volumeKg: number;
};

function groupByWeek(cards: WorkoutHistoryCard[]): WeekGroup[] {
  const map = new Map<string, WorkoutHistoryCard[]>();
  for (const c of cards) {
    const m = mondayOfWeek(c.date);
    const list = map.get(m);
    if (list) list.push(c);
    else map.set(m, [c]);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([monday, weekCards]) => ({
      monday,
      cards: weekCards,
      volumeKg: weekCards.reduce((s, c) => s + c.volumeKg, 0),
    }));
}

function SetPill({
  reps,
  weight,
  done,
  isPr,
}: {
  reps: number | null;
  weight: number;
  done: boolean;
  isPr: boolean;
}) {
  if (!done) {
    return (
      <span className="inline-flex h-8 items-center rounded-lg border border-dashed border-white/15 px-2.5 text-[11px] text-white/30">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center rounded-lg border px-2.5 font-metric text-[12px] tabular-nums",
        isPr
          ? "border-[var(--gym-gold)] bg-[rgba(var(--neon-rgb),0.12)] text-[var(--gym-gold)]"
          : "border-white/14 bg-transparent text-white/75",
      )}
      title={isPr ? "Rekord (e1RM)" : undefined}
    >
      {weight}
      <span className="mx-0.5 text-white/35">×</span>
      {reps ?? "—"}
    </span>
  );
}

function SessionRow({
  card,
  onDeleted,
}: {
  card: WorkoutHistoryCard;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const editable = canEditWorkout(card.endedAt, card.date);
  const deadlineLabel = formatEditDeadline(
    workoutEditDeadlineMs(card.endedAt, card.date),
  );
  const meta = [
    card.durationMinutes != null ? `${card.durationMinutes} min` : null,
    formatSetsLabel(card.setsDone),
    `tydz. ${card.planOccurrence}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const label = card.planLabel || card.title;

  function clearLongPressTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPressing(false);
  }

  function startLongPress() {
    longPressFiredRef.current = false;
    clearLongPressTimer();
    setPressing(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      longPressFiredRef.current = true;
      setPressing(false);
      setDeleteOpen(true);
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
    }, LONG_PRESS_MS);
  }

  function confirmDelete() {
    startTransition(async () => {
      const res = await deleteCompletedWorkout({ workoutId: card.id });
      if (!res.ok) {
        notifyError(res.error);
        return;
      }
      setDeleteOpen(false);
      onDeleted(card.id);
      notifySaved("Usunięto trening z historii.");
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (longPressFiredRef.current) {
            longPressFiredRef.current = false;
            return;
          }
          setOpen((v) => !v);
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          startLongPress();
        }}
        onPointerUp={clearLongPressTimer}
        onPointerCancel={clearLongPressTimer}
        onLostPointerCapture={clearLongPressTimer}
        onContextMenu={(e) => {
          e.preventDefault();
          clearLongPressTimer();
          longPressFiredRef.current = true;
          setDeleteOpen(true);
        }}
        className={cn(
          "flex w-full items-start gap-3 px-3.5 py-3.5 text-left select-none transition",
          pressing && "bg-white/[0.04]",
        )}
      >
        <div className="w-[52px] shrink-0 pt-0.5">
          <p className="text-[11px] leading-tight text-white/40">
            {formatHistoryDayChip(card.date)}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">
            {label}
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">{meta}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <p className="font-metric text-[17px] tabular-nums leading-none text-white">
            {formatHistoryKg(card.volumeKg)}
          </p>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-white/45 transition",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {open ? (
        <div className="space-y-3.5 border-t border-white/[0.06] px-3.5 pb-3.5 pt-3">
          {card.exercises.length === 0 ? (
            <p className="text-xs text-white/40">Brak szczegółów serii.</p>
          ) : (
            <ul className="space-y-3.5">
              {card.exercises.map((ex) => (
                <li key={ex.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-[13px] font-medium text-white/90">
                      {ex.name}
                    </p>
                    <p className="shrink-0 text-[11px] tabular-nums text-white/40">
                      {Math.round(ex.volumeKg)} kg
                    </p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {ex.sets.map((s, i) => (
                      <SetPill
                        key={i}
                        reps={s.reps}
                        weight={s.weight}
                        done={s.done}
                        isPr={s.isPr}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {editable ? (
            <div className="flex items-start gap-3 pt-1">
              <Link
                href={`/workout-history/${card.id}/edit`}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/25 px-4 text-sm font-semibold text-white transition hover:bg-white/[0.04]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Popraw
              </Link>
              <p className="pt-2 text-[11px] leading-snug text-white/40">
                Dopisz brakujące serie albo popraw liczby — do {deadlineLabel}.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="app-dialog w-[min(92vw,400px)] border-white/10 p-0 text-white">
          <div className="relative overflow-hidden rounded-[22px] px-5 pb-5 pt-6 sm:px-6 sm:pb-6 sm:pt-7">
            <div
              className="pointer-events-none absolute inset-0 opacity-90 [background:radial-gradient(520px_220px_at_50%_-20%,rgba(244,63,94,0.18),transparent_62%)]"
              aria-hidden
            />

            <div className="relative flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-400/40 bg-rose-500/12 text-rose-300">
                <AlertTriangle
                  className="h-7 w-7"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </div>

              <AlertDialogTitle className="mt-4 text-lg font-semibold leading-snug tracking-tight text-white">
                Usunąć cały trening?
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 max-w-[18rem] text-[15px] leading-relaxed text-white/65">
                „{label}” zniknie z historii wraz z seriami i tonnażem. Tej
                operacji nie można cofnąć.
              </AlertDialogDescription>

              <div className="mt-6 w-full space-y-2.5">
                <Button
                  type="button"
                  className="gym-btn-primary h-12 w-full rounded-2xl text-base font-semibold"
                  disabled={pending}
                  onClick={() => setDeleteOpen(false)}
                >
                  Anuluj
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  className={cn(
                    "h-12 w-full rounded-2xl border border-rose-500/35 bg-rose-950/35 text-[15px] font-semibold text-rose-200",
                    "hover:border-rose-400/45 hover:bg-rose-950/55 hover:text-rose-100",
                  )}
                  onClick={confirmDelete}
                >
                  {pending ? "Usuwam…" : "Usuń trening"}
                </Button>
              </div>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type Props = {
  overview: WorkoutHistoryOverview;
};

export function WorkoutHistoryView({ overview }: Props) {
  const { kpis, cards, planFilters } = overview;
  const [filterPlanKey, setFilterPlanKey] = useState<string | "all">("all");
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());

  const visibleCards = useMemo(
    () => cards.filter((c) => !removedIds.has(c.id)),
    [cards, removedIds],
  );

  const filtered = useMemo(() => {
    if (filterPlanKey === "all") return visibleCards;
    return visibleCards.filter((c) => c.planCompareKey === filterPlanKey);
  }, [visibleCards, filterPlanKey]);

  const weekGroups = useMemo(() => groupByWeek(filtered), [filtered]);
  const workoutsShown = Math.max(0, kpis.workoutsTotal - removedIds.size);
  const tonnageTonnes = Math.max(0, kpis.tonnageTotalKg) / 1000;
  const countLabel = (() => {
    const n = workoutsShown;
    if (n === 1) return "1 TRENING";
    if (n >= 2 && n <= 4) return `${n} TRENINGI`;
    return `${n} TRENINGÓW`;
  })();

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <Link
        href="/workout-plan"
        className="inline-flex items-center gap-1.5 text-sm text-white/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć
      </Link>

      <header className="space-y-1 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {countLabel}
        </p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white">
          Historia treningów
        </h1>
      </header>

      <div className="app-card grid grid-cols-3 gap-2 px-3 py-4">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Na tydzień
          </p>
          <p className="mt-1.5 text-[1.7rem] leading-none text-white">
            <AnimatedMetric value={kpis.avgWorkoutsPerWeekLast8} decimals={1} />
          </p>
          <p className="mt-1 text-[10px] text-white/35">ost. 8 tyg.</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Średni czas
          </p>
          <p className="mt-1.5 text-[1.7rem] leading-none text-white">
            {kpis.avgDurationMinutes != null ? (
              <>
                <AnimatedMetric value={kpis.avgDurationMinutes} />
                <span className="ml-1 font-metric text-sm text-white/40">min</span>
              </>
            ) : (
              <span className="font-metric text-white/35">—</span>
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Tonaż
          </p>
          <p className="mt-1.5 text-[1.7rem] leading-none text-white">
            <AnimatedMetric value={tonnageTonnes} decimals={1} />
            <span className="ml-1 font-metric text-sm text-white/40">t</span>
          </p>
          <p className="mt-1 text-[10px] text-white/35">łącznie</p>
        </div>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        <button
          type="button"
          onClick={() => setFilterPlanKey("all")}
          className={cn(
            "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
            filterPlanKey === "all"
              ? "border border-[var(--gym-gold)]/70 bg-[rgba(var(--neon-rgb),0.08)] text-[var(--gym-gold)]"
              : "border border-white/12 bg-[var(--gym-surface-sunken)] text-white/75",
          )}
        >
          Wszystkie
        </button>
        {planFilters.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setFilterPlanKey(p.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition",
              filterPlanKey === p.id
                ? "border border-[var(--gym-gold)]/70 bg-[rgba(var(--neon-rgb),0.08)] text-[var(--gym-gold)]"
                : "border border-white/12 bg-[var(--gym-surface-sunken)] text-white/75",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <section className="space-y-6">
        {weekGroups.length === 0 ? (
          <div className="app-card px-4 py-10 text-center text-sm text-white/50">
            Brak zakończonych treningów — ukończ pierwszą sesję, żeby zobaczyć
            historię.
          </div>
        ) : (
          weekGroups.map((week, idx) => (
            <div key={week.monday} className="space-y-2.5">
              <div className="flex items-baseline gap-2.5 px-0.5">
                <span className="font-metric text-[22px] leading-none text-[var(--gym-gold)]">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
                  {formatHistoryWeekRange(week.monday)}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-white/40">
                  {week.cards.length} tr. · {formatTonnes(week.volumeKg)}
                </span>
              </div>
              <div className="h-px bg-white/[0.08]" />
              <div className="overflow-hidden app-panel divide-y divide-white/[0.06]">
                {week.cards.map((card) => (
                  <SessionRow
                    key={card.id}
                    card={card}
                    onDeleted={(id) =>
                      setRemovedIds((prev) => {
                        const next = new Set(prev);
                        next.add(id);
                        return next;
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
