"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  Clock3,
  Flame,
  Grid2x2,
  HelpCircle,
  History,
  Play,
  Printer,
  Download,
} from "lucide-react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import type { TreningiHubStats } from "@/lib/treningi-hub-stats";
import { CardioLogSheet } from "@/components/treningi/cardio-log-sheet";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function formatShortDate(ymd: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
    }).format(new Date(`${ymd}T12:00:00`));
  } catch {
    return ymd;
  }
}

function HelpPill({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#141414] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/70"
      >
        <HelpCircle className="h-3 w-3 text-white/45" />
        {label}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="border-white/10 bg-[#0c0c0c] text-white">
          <SheetHeader>
            <SheetTitle className="text-white">{title}</SheetTitle>
          </SheetHeader>
          <p className="px-4 pb-6 text-sm leading-relaxed text-white/65">{body}</p>
        </SheetContent>
      </Sheet>
    </>
  );
}

type TreningiHubProps = {
  plans: WorkoutPlanWithLastWorkoutDTO[];
  stats: TreningiHubStats;
  onBegin: (row: WorkoutPlanWithLastWorkoutDTO) => void;
};

export function TreningiHub({ plans, stats, onBegin }: TreningiHubProps) {
  const [selectedId, setSelectedId] = useState<string | null>(plans[0]?.id ?? null);
  const [cardioOpen, setCardioOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const selected = useMemo(
    () => plans.find((p) => p.id === selectedId) ?? plans[0] ?? null,
    [plans, selectedId],
  );

  const exerciseCount = selected?.plan.exercises.length ?? 0;

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--gym-gold)]">
          Treningi
        </p>
        <h1 className="mt-1 font-display text-3xl tracking-wide text-white">
          Treningi
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => flash("Eksport PDF w przygotowaniu.")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-[#121212] text-xs font-medium text-white/80"
        >
          <Printer className="h-3.5 w-3.5 text-[var(--gym-gold)]" />
          PDF / drukuj
        </button>
        <button
          type="button"
          onClick={() => flash("Eksport Word w przygotowaniu.")}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-[#121212] text-xs font-medium text-white/80"
        >
          <Download className="h-3.5 w-3.5 text-[var(--gym-gold)]" />
          Word
        </button>
        <button
          type="button"
          onClick={() => {
            if (!selected) {
              flash("Najpierw ustaw plan w Profilu.");
              return;
            }
            setSheetOpen(true);
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[rgba(var(--neon-rgb),0.45)] bg-[#121212] text-xs font-medium text-white"
        >
          <Grid2x2 className="h-3.5 w-3.5 text-[var(--gym-gold)]" />
          Arkusz i ciężary
        </button>
        <Link
          href="/workout-history"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/12 bg-[#121212] text-xs font-medium text-white/80"
        >
          <History className="h-3.5 w-3.5 text-[var(--gym-gold)]" />
          Historia treningów
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#141414] p-5 text-center">
          <p className="text-sm text-white/70">
            Nie masz jeszcze planu. Ustaw dni i ćwiczenia w Profilu.
          </p>
          <Link
            href="/profile/workout-plan"
            className="gold-btn mt-4 inline-flex h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold"
          >
            Ustaw plan w profilu
          </Link>
        </div>
      ) : (
        <>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {plans.map((row) => {
              const active = row.id === selected?.id;
              const label = row.plan.planName.trim() || "Plan";
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition",
                    active
                      ? "bg-[var(--gym-gold)] text-[var(--neon-fg)]"
                      : "border border-white/10 bg-[#141414] text-white/70",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <HelpPill
              label="Serie"
              title="Serie"
              body="Liczba serii w ćwiczeniu (np. 2s). W trybie prowadzonym zaliczasz je po kolei."
            />
            <HelpPill
              label="RIR"
              title="RIR (w zapasie)"
              body="Reps In Reserve — ile powtórzeń zostało Ci w zapasie po serii. 0 = do upadku, 1–2 = kontrolowany zapas."
            />
            <HelpPill
              label="Tempo"
              title="Tempo"
              body="Cztery cyfry tempa (np. 2010): ekscentryka – pauza dołu – koncentryka – pauza góry, w sekundach."
            />
          </div>

          <section className="rounded-2xl border border-white/[0.08] bg-[#161616] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              Trening prowadzony
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              {selected?.plan.planName.trim() || "Plan"} · {exerciseCount}{" "}
              {exerciseCount === 1 ? "ćwiczenie" : "ćwiczeń"}
            </h2>
            <p className="mt-1.5 text-sm text-white/55">
              Seria po serii, z odliczaniem przerw. Wynik trafia do historii.
            </p>
            <button
              type="button"
              disabled={!selected || exerciseCount === 0 || pending}
              onClick={() => {
                if (!selected) return;
                startTransition(() => onBegin(selected));
              }}
              className="gold-btn mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold disabled:opacity-50"
            >
              <Play className="h-5 w-5 fill-current" />
              {pending ? "Startuję…" : "Rozpocznij trening"}
            </button>
            <button
              type="button"
              onClick={() => setCardioOpen(true)}
              className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(var(--neon-rgb),0.45)] bg-transparent text-sm font-semibold text-white"
            >
              <Flame className="h-4 w-4 text-[var(--gym-gold)]" />
              Dodaj cardio
            </button>
          </section>
        </>
      )}

      {plans.length === 0 ? (
        <button
          type="button"
          onClick={() => setCardioOpen(true)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[rgba(var(--neon-rgb),0.45)] bg-[#121212] text-sm font-semibold text-white"
        >
          <Flame className="h-4 w-4 text-[var(--gym-gold)]" />
          Dodaj cardio
        </button>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
            Treningi w tyg.
          </p>
          <p className="mt-2 font-display text-3xl tabular-nums text-[var(--gym-gold)]">
            {stats.workoutsThisWeek}
          </p>
          <p className="mt-1 text-[10px] leading-snug text-white/35">
            liczę tryb prowadzony
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
            Cardio w tyg.
          </p>
          <p className="mt-2 font-display text-3xl tabular-nums text-[var(--gym-gold)]">
            {stats.cardioMinutesThisWeek}
            <span className="text-base text-white/40">/{stats.cardioGoalMinutes}</span>
          </p>
          <p className="mt-1 text-[10px] text-white/35">minuty</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
            Tonaż w tyg.
          </p>
          <p className="mt-2 font-display text-3xl tabular-nums text-[var(--gym-gold)]">
            {stats.tonnageThisWeekKg}
            <span className="text-base text-white/40"> kg</span>
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#141414] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
            Tygodnie z rzędu
          </p>
          <p className="mt-2 font-display text-3xl tabular-nums text-[var(--gym-gold)]">
            {stats.streakWeeks}
          </p>
        </div>
      </div>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          Ostatnie treningi
        </h3>
        {stats.recentWorkouts.length === 0 ? (
          <p className="mt-3 text-sm text-white/45">
            Jeszcze nic. Pierwszy trening z trybu prowadzonego pojawi się tutaj.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stats.recentWorkouts.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#141414] px-3.5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{w.title}</p>
                  <p className="mt-0.5 text-xs text-white/45">{formatShortDate(w.date)}</p>
                </div>
                <div className="text-right text-xs text-[var(--gym-gold)] tabular-nums">
                  {w.volumeKg} kg
                  {w.durationMinutes != null ? (
                    <p className="text-white/40">{w.durationMinutes} min</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          Ostatnie cardio
        </h3>
        {stats.recentCardio.length === 0 ? (
          <p className="mt-3 text-sm text-white/45">Brak wpisów cardio.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stats.recentCardio.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#141414] px-3.5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{c.title}</p>
                  <p className="mt-0.5 text-xs text-white/45">
                    {formatShortDate(c.date)}
                    {c.avgHr != null ? ` · ${c.avgHr} bpm` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-[var(--gym-gold)]">
                  {c.minutes} min
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-white/35">
        Ustawianie planu treningowego jest w{" "}
        <Link href="/profile/workout-plan" className="text-[var(--gym-gold)] underline-offset-2 hover:underline">
          Profilu
        </Link>
        .
      </p>

      <CardioLogSheet
        open={cardioOpen}
        onClose={() => setCardioOpen(false)}
        cardioGoalMinutes={stats.cardioGoalMinutes}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] border-white/10 bg-[#0c0c0c] text-white">
          <SheetHeader>
            <SheetTitle className="text-white">
              Arkusz · {selected?.plan.planName.trim() || "Plan"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-0 overflow-y-auto px-1 pb-8">
            {(selected?.plan.exercises ?? []).map((ex) => (
              <div
                key={ex.id}
                className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{ex.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-white/40">
                    {ex.sets}s {ex.reps} powt.
                  </p>
                </div>
                <div className="flex gap-2">
                  {Array.from({ length: Math.min(ex.sets, 2) }).map((_, i) => (
                    <div
                      key={i}
                      className="flex h-10 w-[4.75rem] items-center justify-center rounded-lg border border-white/10 bg-[#161616] text-[11px] text-white/35"
                    >
                      kg × powt.
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <p className="px-3 pt-4 text-xs text-white/40">
              Wpisywanie serii odbywa się w trybie prowadzonym — użyj „Rozpocznij trening”.
            </p>
            <button
              type="button"
              disabled={!selected || exerciseCount === 0}
              onClick={() => {
                if (!selected) return;
                setSheetOpen(false);
                startTransition(() => onBegin(selected));
              }}
              className="gold-btn mx-3 mt-2 inline-flex h-12 w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            >
              <Clock3 className="h-4 w-4" />
              Start z arkusza
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {toast ? (
        <div className="fixed bottom-28 left-1/2 z-[90] -translate-x-1/2 rounded-full border border-white/10 bg-[#1a1a1a] px-4 py-2 text-xs text-white/80 shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
