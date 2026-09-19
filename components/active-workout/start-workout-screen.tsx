"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Dumbbell, History, Pencil, Search, Sparkles } from "lucide-react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { Input } from "@/components/ui/input";
import { WorkoutGlassCard } from "@/components/active-workout/workout-glass-card";
import { WorkoutPlanCard } from "@/components/active-workout/workout-plan-card";
import { cn } from "@/lib/utils";

function formatLastWorkoutDate(ymd: string | null) {
  if (!ymd) return "Jeszcze nie trenowano";
  try {
    const d = new Date(`${ymd}T12:00:00`);
    return new Intl.DateTimeFormat("pl-PL", {
      dateStyle: "medium",
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

function polishPlansLabel(n: number) {
  if (n === 1) return "plan";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "plany";
  return "planów";
}

function polishExercisesWord(n: number) {
  if (n === 1) return "ćwiczenie";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "ćwiczenia";
  return "ćwiczeń";
}

type StartWorkoutScreenProps = {
  plans: WorkoutPlanWithLastWorkoutDTO[];
  activePlanId: string | null;
  onBegin: (row: WorkoutPlanWithLastWorkoutDTO) => void;
};

export function StartWorkoutScreen({ plans, activePlanId, onBegin }: StartWorkoutScreenProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return plans;
    return plans.filter((row) => {
      const name = normalizeSearch(row.plan.planName || "");
      return name.includes(q);
    });
  }, [plans, query]);

  const totalExercises = useMemo(
    () => plans.reduce((acc, p) => acc + p.plan.exercises.length, 0),
    [plans],
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="glass-panel p-8">
        <div className="text-center">
          <div className="mx-auto max-w-lg">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
              Przed treningiem
            </p>
            <h1 className="font-heading mt-2 text-2xl font-semibold text-white">
              Rozpocznij sesję
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Wybierz plan — wczytamy ćwiczenia, serie i podpowiedzi z ostatniego treningu. Możesz od
              razu przejść do zapisu serii na ekranie treningu.
            </p>
          </div>
          {plans.length > 0 ? (
            <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-white/55">
              <span className="rounded-lg border border-white/15 bg-black/50 px-3 py-2">
                <span className="font-semibold text-white">{plans.length}</span>{" "}
                {polishPlansLabel(plans.length)}
              </span>
              <span className="rounded-lg border border-white/15 bg-black/50 px-3 py-2">
                <span className="font-semibold text-white">{totalExercises}</span>{" "}
                {polishExercisesWord(totalExercises)} w planach
              </span>
            </div>
          ) : null}
        </div>

        {plans.length > 0 ? (
          <div className="relative mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { step: "1", title: "Wybierz plan", body: "Kliknij kartę poniżej — od razu startujesz sesję." },
              { step: "2", title: "Zapisuj serie", body: "Wpisy powtórzeń i ciężaru zapisują postęp." },
              { step: "3", title: "Zakończ", body: "Podsumowanie trafi do raportów i historii." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-lg border border-white/15 bg-black/50 px-4 py-4 text-center"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                  Krok {item.step}
                </p>
                <p className="mt-2 font-heading text-base font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm text-white/60">{item.body}</p>
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-start">
        <div className="min-w-0 space-y-4">
          {plans.length > 0 ? (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj planu po nazwie…"
                autoComplete="off"
                aria-label="Szukaj planu treningowego"
                className="pl-10"
              />
            </div>
          ) : null}

          <div
            role="region"
            aria-label="Lista planów treningowych"
            className="grid gap-3 sm:grid-cols-2"
          >
            {plans.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="sm:col-span-2"
              >
                <WorkoutGlassCard className="p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">Brak planów treningowych</p>
                      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-white/55">
                        Utwórz pierwszy plan z ćwiczeniami — wtedy pojawi się tutaj i będziesz mógł
                        wystartować sesję jednym kliknięciem.
                      </p>
                    </div>
                    <Link
                      href="/workout-plan"
                      className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-[var(--neon)] px-5 text-base font-semibold text-white transition hover:bg-[#ff4d6d]"
                    >
                      Utwórz plan
                    </Link>
                  </div>
                </WorkoutGlassCard>
              </motion.div>
            ) : filtered.length === 0 ? (
              <div className="sm:col-span-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center">
                <p className="text-sm font-medium text-white/80">Brak wyników dla „{query.trim()}”</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-3 text-[13px] font-medium text-[#FF1A4B] underline-offset-2 hover:underline"
                >
                  Wyczyść wyszukiwanie
                </button>
              </div>
            ) : (
              filtered.map((row, i) => {
                const empty = row.plan.exercises.length === 0;
                const active = activePlanId === row.id;
                return (
                  <WorkoutPlanCard
                    key={row.id}
                    row={row}
                    index={i}
                    active={active}
                    empty={empty}
                    lastActivityLabel={formatLastWorkoutDate(row.lastWorkoutDate)}
                    onStart={() => onBegin(row)}
                    startLabel={active ? "Wczytaj ponownie" : "Rozpocznij trening"}
                  />
                );
              })
            )}
          </div>

          {plans.length > 0 ? (
            <p className="text-center text-[11px] text-white/35 lg:text-left" aria-live="polite">
              {filtered.length === plans.length
                ? `Wszystkie plany (${plans.length}).`
                : `Widoczne: ${filtered.length} z ${plans.length} planów.`}
            </p>
          ) : null}
        </div>

        <motion.aside
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
          className="flex flex-col gap-4 lg:sticky lg:top-4"
        >
          <WorkoutGlassCard className="p-4">
            <div className="flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4 text-[#FF1A4B]" aria-hidden />
              <p className="text-sm font-semibold">Przed startem</p>
            </div>
            <ul className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-white/55">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF1A4B]/80" />
                Krótka rozgrzewka poprawia jakość pierwszych serii.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/25" />
                Timer odpoczynku włącza się po uzupełnieniu serii (ustawienia na ekranie treningu).
              </li>
            </ul>
          </WorkoutGlassCard>

          <div className="rounded-xl border border-white/[0.08] bg-[#121216] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Skróty
            </p>
            <div className="mt-3 grid gap-2">
              <Link
                href="/workout-plan"
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5",
                  "text-[13px] text-white/85 transition hover:border-white/[0.12] hover:bg-white/[0.06]",
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06]">
                  <Pencil className="h-4 w-4 text-[#FF9500]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">Edytuj plany</span>
                  <span className="block text-[11px] text-white/45">Dodaj ćwiczenia i nazwy dni</span>
                </span>
              </Link>
              <Link
                href="/workout-history"
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5",
                  "text-[13px] text-white/85 transition hover:border-white/[0.12] hover:bg-white/[0.06]",
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06]">
                  <History className="h-4 w-4 text-sky-400/90" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">Historia treningów</span>
                  <span className="block text-[11px] text-white/45">Ostatnie sesje i tonaż</span>
                </span>
              </Link>
            </div>
          </div>

          <div className="hidden items-center gap-3 rounded-xl border border-dashed border-white/[0.1] px-4 py-3 text-[12px] text-white/40 lg:flex">
            <Dumbbell className="h-5 w-5 shrink-0 text-white/25" aria-hidden />
            <span>Plan z pustą listą ćwiczeń nie uruchomi sesji — uzupełnij go w edytorze.</span>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
