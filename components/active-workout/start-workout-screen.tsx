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
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#141418] via-[#0f0f12] to-[#0a0a0c] p-5 sm:p-7">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-[0.35]"
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,26,75,0.35) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-16 h-52 w-52 rounded-full opacity-25"
          style={{
            background:
              "radial-gradient(circle at center, rgba(59,130,246,0.4) 0%, transparent 70%)",
          }}
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Przed treningiem
            </p>
            <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight text-white sm:text-[1.75rem]">
              Rozpocznij sesję
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-white/50 sm:text-[14px]">
              Wybierz plan — wczytamy ćwiczenia, serie i podpowiedzi z ostatniego treningu. Możesz od
              razu przejść do zapisu serii na ekranie treningu.
            </p>
          </div>
          {plans.length > 0 ? (
            <div className="flex shrink-0 flex-wrap gap-2 text-[12px] text-white/55">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
                <span className="font-semibold text-white/80">{plans.length}</span>{" "}
                {polishPlansLabel(plans.length)}
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
                <span className="font-semibold text-white/80">{totalExercises}</span>{" "}
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
                className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3 backdrop-blur-sm sm:px-4"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#FF1A4B]/90">
                  Krok {item.step}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-[11px] leading-snug text-white/45">{item.body}</p>
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
                className="h-11 rounded-xl border-white/[0.1] bg-white/[0.05] pl-10 text-white placeholder:text-white/35 focus-visible:ring-[#FF1A4B]/30"
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
                      className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#FF1A4B] px-5 text-sm font-semibold text-white transition hover:brightness-110"
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
                  <span className="block text-[11px] text-white/45">Ostatnie sesje i wolumen</span>
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
