"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Dumbbell, History, Pencil, Search } from "lucide-react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import type { HomeStats } from "@/lib/home-stats";
import { Input } from "@/components/ui/input";
import { WorkoutTrendChart } from "@/components/home/workout-trend-chart";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function formatLastWorkoutDate(ymd: string | null) {
  if (!ymd) return null;
  try {
    const d = new Date(`${ymd}T12:00:00`);
    return new Intl.DateTimeFormat("pl-PL", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return ymd;
  }
}

function normalizeSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function StatTile({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "gold" | "mint";
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.08] bg-[#161616] px-3 py-3 text-center">
      <p
        className={cn(
          "font-display text-[26px] leading-none tabular-nums",
          tone === "gold" ? "text-[var(--gym-gold)]" : "text-emerald-300",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-white/45">
        {label}
      </p>
    </div>
  );
}

type StartWorkoutScreenProps = {
  plans: WorkoutPlanWithLastWorkoutDTO[];
  activePlanId: string | null;
  onBegin: (row: WorkoutPlanWithLastWorkoutDTO) => void;
  homeStats?: HomeStats | null;
  workoutDaysThisWeek?: boolean[];
};

export function StartWorkoutScreen({
  plans,
  activePlanId,
  onBegin,
  homeStats = null,
  workoutDaysThisWeek = [false, false, false, false, false, false, false],
}: StartWorkoutScreenProps) {
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [trendMode, setTrendMode] = useState<"volume" | "reps">("volume");

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return plans;
    return plans.filter((row) => {
      const name = normalizeSearch(row.plan.planName || "");
      return name.includes(q);
    });
  }, [plans, query]);

  const last = homeStats?.lastWorkout ?? null;
  const dayLabels = ["Pon.", "Wt.", "Śr.", "Czw.", "Pt.", "Sob.", "Niedz."];

  const trendData = useMemo(() => {
    if (!homeStats?.trend?.length) return [];
    return homeStats.trend;
  }, [homeStats]);

  function beginFromPicker(row: WorkoutPlanWithLastWorkoutDTO) {
    setPickerOpen(false);
    onBegin(row);
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 pb-8">
      <header className="px-0.5 pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--gym-gold)]">
          Start
        </p>
        <h1 className="font-heading mt-1 text-3xl font-semibold text-white">Trening</h1>
      </header>

      <section className="rounded-[22px] border border-white/[0.1] bg-[#121214] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Ostatni trening
          </p>
          {last ? (
            <Link href="/workout-history" className="text-xs text-[var(--gym-gold)]">
              Historia ›
            </Link>
          ) : null}
        </div>
        {last ? (
          <>
            <p className="mt-1 text-sm text-white/70">{last.title}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatTile
                value={
                  homeStats?.deltaVolumeKg != null
                    ? `${homeStats.deltaVolumeKg > 0 ? "+" : ""}${Math.round(homeStats.deltaVolumeKg)}`
                    : "—"
                }
                label="postęp kg"
                tone="mint"
              />
              <StatTile
                value={Math.round(last.volumeKg).toLocaleString("pl-PL")}
                label="suma kg"
                tone="gold"
              />
              <StatTile
                value={
                  homeStats?.deltaTotalReps != null
                    ? `${homeStats.deltaTotalReps > 0 ? "+" : ""}${homeStats.deltaTotalReps}`
                    : "—"
                }
                label="postęp powt."
                tone="mint"
              />
              <StatTile
                value={String(last.totalReps)}
                label="suma powt."
                tone="gold"
              />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-white/45">
            Brak zakończonych sesji — rozpocznij pierwszy trening.
          </p>
        )}
      </section>

      <section className="rounded-[22px] border border-white/[0.1] bg-[#121214] px-2 py-3">
        <div className="flex items-end justify-between gap-1">
          {dayLabels.map((label, i) => {
            const on = workoutDaysThisWeek[i] ?? false;
            return (
              <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase",
                    on ? "text-[var(--gym-gold)]" : "text-white/35",
                  )}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border",
                    on
                      ? "border-[var(--gym-gold)] bg-[var(--gym-gold)] text-black"
                      : "border-white/15 text-transparent",
                  )}
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[22px] border border-white/[0.1] bg-[#121214] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Ostatnie treningi
          </p>
          <div className="flex gap-1 rounded-full bg-white/[0.04] p-0.5">
            <button
              type="button"
              onClick={() => setTrendMode("volume")}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold",
                trendMode === "volume"
                  ? "bg-[var(--gym-gold)] text-black"
                  : "text-white/45",
              )}
            >
              Ciężar
            </button>
            <button
              type="button"
              onClick={() => setTrendMode("reps")}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold",
                trendMode === "reps"
                  ? "bg-[var(--gym-gold)] text-black"
                  : "text-white/45",
              )}
            >
              Powt.
            </button>
          </div>
        </div>
        <div className="mt-2">
          {trendMode === "volume" ? (
            <WorkoutTrendChart data={trendData} />
          ) : (
            <WorkoutTrendChart
              data={trendData.map((p) => ({
                ...p,
                volumeKg: p.totalReps,
              }))}
            />
          )}
        </div>
      </section>

      <button
        type="button"
        disabled={plans.length === 0}
        onClick={() => setPickerOpen(true)}
        className="gym-btn-primary inline-flex h-14 w-full items-center justify-center rounded-full text-base font-bold uppercase tracking-wide disabled:opacity-40"
      >
        Rozpocznij trening
      </button>

      <div className="flex items-center justify-between gap-3 px-1">
        <Link
          href="/workout-plan"
          className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white/80"
        >
          <Pencil className="h-4 w-4" />
          Plany
        </Link>
        <Link
          href="/workout-history"
          className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white/80"
        >
          <History className="h-4 w-4" />
          Historia
        </Link>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-white/15 bg-[#161616] p-5 text-center">
          <Dumbbell className="mx-auto h-8 w-8 text-[var(--gym-gold)]" />
          <p className="mt-3 text-sm font-semibold text-white">Brak planów</p>
          <p className="mt-1 text-sm text-white/45">
            Najpierw utwórz plan z ćwiczeniami.
          </p>
          <Link
            href="/workout-plan"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-[var(--gym-gold)] px-5 text-sm font-semibold text-black"
          >
            Nowy plan
          </Link>
        </div>
      ) : null}

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] border-white/10 bg-[#0c0c0c] text-white">
          <SheetHeader>
            <SheetTitle className="text-white">Wybierz plan</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto px-4 pb-8">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj planu…"
                className="pl-10"
              />
            </div>
            <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10">
              {filtered.map((row) => {
                const name = row.plan.planName.trim() || "Plan bez nazwy";
                const used = formatLastWorkoutDate(row.lastWorkoutDate);
                const empty = row.plan.exercises.length === 0;
                const active = activePlanId === row.id;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      disabled={empty}
                      onClick={() => beginFromPicker(row)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left disabled:opacity-40"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">
                          {name}
                          {active ? (
                            <span className="ml-2 text-[10px] font-medium text-[var(--gym-gold)]">
                              AKTYWNY
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-white/40">
                          {empty
                            ? "Brak ćwiczeń — uzupełnij plan"
                            : used
                              ? `Użyto: ${used}`
                              : "Jeszcze nie trenowano"}
                        </p>
                      </div>
                      <span className="text-white/35">›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
