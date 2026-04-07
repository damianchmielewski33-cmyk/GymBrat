"use client";

import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Loader2,
  Minus,
  Plus,
  Timer,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";

type WorkoutSet = {
  reps: number;
  done: boolean;
};

type WorkoutExercise = {
  id: string;
  name: string;
  sets: WorkoutSet[];
};

const MOCK_EXERCISES: WorkoutExercise[] = [
  {
    id: "bench",
    name: "Wyciskanie na ławce",
    sets: [
      { reps: 8, done: false },
      { reps: 8, done: false },
      { reps: 8, done: false },
    ],
  },
  {
    id: "row",
    name: "Wiosłowanie na ławce (chest-supported)",
    sets: [
      { reps: 10, done: false },
      { reps: 10, done: false },
      { reps: 10, done: false },
    ],
  },
  {
    id: "squat",
    name: "Przysiady na hack-maszynie",
    sets: [
      { reps: 12, done: false },
      { reps: 12, done: false },
      { reps: 12, done: false },
    ],
  },
];

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export default function ActiveWorkoutPage() {
  const { startedAt, title, setTitle, start, reset } = useActiveWorkoutStore();
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();

  const [cardioMinutes, setCardioMinutes] = useState<number>(20);
  const [exercises, setExercises] = useState<WorkoutExercise[]>(() =>
    MOCK_EXERCISES.map((e) => ({
      ...e,
      sets: e.sets.map((s) => ({ ...s })),
    })),
  );
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(
    MOCK_EXERCISES[0]?.id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const elapsed =
    startedAt == null
      ? 0
      : Math.max(0, Math.floor((now - startedAt) / 1000));

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const completedSets = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        total += 1;
        if (s.done) done += 1;
      }
    }
    return { done, total };
  }, [exercises]);

  async function completeWorkout() {
    setSaveError(null);
    setSaving(true);
    try {
      const endedAt = Date.now();
      const res = await fetch("/api/workouts/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          startedAt,
          endedAt,
          cardioMinutes,
          exercises,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Nie udało się zapisać treningu");
      }
      reset();
      router.push("/reports");
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Nie udało się zapisać treningu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Sesja
        </p>
        <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">
          Aktywny trening
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Odhaczaj serie w trakcie. Po zakończeniu sesji zapiszemy do Turso minuty cardio,
          datę oraz JSON ćwiczeń.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="glass-panel relative overflow-hidden p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(120deg,rgba(255,255,255,0.12),transparent_45%),radial-gradient(700px_320px_at_12%_10%,rgba(255,45,85,0.18),transparent_60%)]" />
          <div className="relative">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 flex-1">
                <label className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
                  Nazwa treningu
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-2 h-11 rounded-xl border-white/15 bg-black/30 px-4 text-base ring-[var(--neon)]/40 focus-visible:ring-3 focus-visible:ring-[var(--neon)]/25"
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={start}
                    className="bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    {startedAt ? "Wznów" : "Start"}
                  </Button>
                  <Button type="button" variant="outline" onClick={reset}>
                    Resetuj
                  </Button>
                  <div className="ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/60">
                    <Dumbbell className="h-4 w-4 text-white/70" />
                    <span className="tabular-nums">
                      Serie {completedSets.done}/{completedSets.total}
                    </span>
                  </div>
                </div>
              </div>

              <motion.div
                layout
                className="flex w-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/30 p-6 md:w-[260px]"
              >
                <Timer className="mb-3 h-7 w-7 text-[var(--neon)]" />
                <p className="text-[11px] uppercase tracking-[0.35em] text-white/45">
                  Czas
                </p>
                <motion.p
                  key={elapsed}
                  initial={{ opacity: 0.4, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-heading mt-1 text-4xl font-semibold tabular-nums"
                >
                  {mm}:{ss}
                </motion.p>
                <p className="mt-2 text-center text-xs text-white/45">
                  Zapisz powtórzenia i wyślij do Turso.
                </p>
              </motion.div>
            </div>

            <div className="mt-8 grid gap-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
                    Ćwiczenia (mock)
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    Ta lista jest na razie przykładowa — zapis i tak utrwali jej JSON.
                  </p>
                </div>
              </div>

              <motion.div layout className="space-y-3">
                {exercises.map((ex) => {
                  const open = openExerciseId === ex.id;
                  const doneCount = ex.sets.filter((s) => s.done).length;
                  return (
                    <motion.div
                      layout
                      key={ex.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-black/25"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenExerciseId(open ? null : ex.id)}
                        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                      >
                        <div className="min-w-0">
                          <p className="font-heading truncate text-base font-semibold">
                            {ex.name}
                          </p>
                          <p className="mt-1 text-xs text-white/55">
                            {doneCount}/{ex.sets.length} serii oznaczonych jako zrobione
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-medium text-white/70">
                            {ex.sets.reduce((sum, s) => sum + (s.reps || 0), 0)} powt.
                          </span>
                          {open ? (
                            <ChevronUp className="h-4 w-4 text-white/60" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-white/60" />
                          )}
                        </div>
                      </button>

                      <motion.div
                        layout
                        initial={false}
                        animate={{
                          height: open ? "auto" : 0,
                          opacity: open ? 1 : 0,
                        }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="px-4"
                      >
                        <div className="pb-4">
                          <div className="grid gap-2">
                            {ex.sets.map((s, setIdx) => (
                              <div
                                key={`${ex.id}-${setIdx}`}
                                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                              >
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExercises((prev) =>
                                        prev.map((p) =>
                                          p.id !== ex.id
                                            ? p
                                            : {
                                                ...p,
                                                sets: p.sets.map((ps, i) =>
                                                  i !== setIdx
                                                    ? ps
                                                    : { ...ps, done: !ps.done },
                                                ),
                                              },
                                        ),
                                      );
                                    }}
                                    className={[
                                      "inline-flex h-8 w-8 items-center justify-center rounded-lg border text-white transition",
                                      s.done
                                        ? "border-[var(--neon)]/40 bg-[var(--neon)]/15"
                                        : "border-white/10 bg-black/20 hover:border-white/20",
                                    ].join(" ")}
                                    aria-label={
                                      s.done ? "Oznacz serię jako niezrobioną" : "Oznacz serię jako zrobioną"
                                    }
                                  >
                                    <Check
                                      className={[
                                        "h-4 w-4",
                                        s.done ? "text-[var(--neon)]" : "text-white/50",
                                      ].join(" ")}
                                    />
                                  </button>
                                  <div>
                                    <p className="text-sm font-medium text-white/85">
                                      Seria {setIdx + 1}
                                    </p>
                                    <p className="text-xs text-white/45">
                                      Kliknij, gdy zrobiona
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      setExercises((prev) =>
                                        prev.map((p) =>
                                          p.id !== ex.id
                                            ? p
                                            : {
                                                ...p,
                                                sets: p.sets.map((ps, i) =>
                                                  i !== setIdx
                                                    ? ps
                                                    : {
                                                        ...ps,
                                                        reps: clampInt(ps.reps - 1, 0, 99),
                                                      },
                                                ),
                                              },
                                        ),
                                      );
                                    }}
                                    aria-label="Zmniejsz liczbę powtórzeń"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <div className="w-14 text-center">
                                    <p className="font-heading text-lg font-semibold tabular-nums">
                                      {s.reps}
                                    </p>
                                    <p className="text-[10px] uppercase tracking-[0.25em] text-white/45">
                                      powt.
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      setExercises((prev) =>
                                        prev.map((p) =>
                                          p.id !== ex.id
                                            ? p
                                            : {
                                                ...p,
                                                sets: p.sets.map((ps, i) =>
                                                  i !== setIdx
                                                    ? ps
                                                    : {
                                                        ...ps,
                                                        reps: clampInt(ps.reps + 1, 0, 99),
                                                      },
                                                ),
                                              },
                                        ),
                                      );
                                    }}
                                    aria-label="Zwiększ liczbę powtórzeń"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-3 flex justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setExercises((prev) =>
                                  prev.map((p) =>
                                    p.id !== ex.id
                                      ? p
                                      : {
                                          ...p,
                                          sets: [...p.sets, { reps: 10, done: false }],
                                        },
                                  ),
                                );
                              }}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Dodaj serię
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </motion.section>

        <motion.aside
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
          className="glass-panel relative overflow-hidden p-6 sm:p-8"
        >
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(310deg,rgba(255,255,255,0.08),transparent_50%),radial-gradient(700px_420px_at_88%_0%,rgba(120,120,140,0.16),transparent_60%)]" />
          <div className="relative space-y-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
                Cardio
              </p>
              <h2 className="font-heading mt-1 text-xl font-semibold">
                Minuty (opcjonalnie)
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Przykład: 20 minut. Zapisze się do Turso po zakończeniu.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-white/55">Minuty cardio</label>
              <Input
                type="number"
                min={0}
                value={cardioMinutes}
                onChange={(e) => setCardioMinutes(clampInt(Number(e.target.value), 0, 600))}
                className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
              />
            </div>

            {saveError ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
                {saveError}
              </div>
            ) : null}

            <div className="space-y-3">
              <Button
                type="button"
                onClick={completeWorkout}
                disabled={saving}
                className="h-11 w-full bg-[var(--neon)] text-white hover:bg-[#ff4d6d]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Zapisywanie…
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Zakończ trening
                  </>
                )}
              </Button>
              <p className="text-xs text-white/45">
                Zapisujemy: datę treningu (endedAt), minuty cardio oraz JSON ćwiczeń.
              </p>
            </div>
          </div>
        </motion.aside>
      </div>
    </div>
  );
}
