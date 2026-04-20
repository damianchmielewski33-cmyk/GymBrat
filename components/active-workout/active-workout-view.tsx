"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import { ActiveSessionCard } from "@/components/active-workout/active-session-card";
import { GymPadSessionLayout } from "@/components/active-workout/gympad-session-layout";
import { PlanProgressHeader } from "@/components/active-workout/plan-progress-header";
import { WorkoutPlanCard } from "@/components/active-workout/workout-plan-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RestTimerBar } from "@/components/workout/RestTimerBar";
import type { WorkoutExerciseState } from "@/components/workout/types";
import { WorkoutSummary } from "@/components/workout/WorkoutSummary";
import type { WorkoutPlanExercise } from "@/lib/workout-plan-types";
import { sessionVolume } from "@/lib/workout-session-calculations";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { SlidersHorizontal, RotateCcw, ScrollText } from "lucide-react";

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Domyślnie 3 serie: puste powtórzenia (null); z planu można wypełnić przy starcie. */
function planExercisesToSession(exercises: WorkoutPlanExercise[]): WorkoutExerciseState[] {
  return exercises.map((ex) => ({
    id: ex.id,
    name: ex.name,
    sets: Array.from({ length: 3 }, () => ({
      reps:
        typeof ex.reps === "number" && Number.isFinite(ex.reps) && ex.reps > 0
          ? clampInt(ex.reps, 1, 99)
          : null,
      weight: 0,
      done: false,
    })),
  }));
}

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

export function ActiveWorkoutView({
  initialPlans,
  entry = "active",
}: {
  initialPlans: WorkoutPlanWithLastWorkoutDTO[];
  entry?: "active" | "start";
}) {
  const {
    startedAt,
    pausedElapsedSeconds,
    workoutStartedAtMs,
    title,
    workoutPlanId,
    cardioMinutes,
    exercises,
    selectedExerciseId,
    applyPlan,
    start,
    reset,
    setCardioMinutes,
    setExercises,
    setSelectedExerciseId,
    patchSet: patchSetInStore,
  } = useActiveWorkoutStore();
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [suppressRouteGate, setSuppressRouteGate] = useState(false);

  const hasLoadedPlan = workoutPlanId != null && exercises.length > 0;

  // Route gating:
  // - `/active-workout` is a strict "session view" and must NOT be accessible without an active session.
  // - `/start-workout` is the entry point that lets user pick a plan and begin a session.
  useEffect(() => {
    if (suppressRouteGate) return;
    if (entry === "active" && !hasLoadedPlan) {
      router.replace("/start-workout");
      return;
    }
    if (entry === "start" && hasLoadedPlan) {
      router.replace("/active-workout");
    }
  }, [entry, hasLoadedPlan, router, suppressRouteGate]);

  function startRest(seconds: number) {
    setRestRemaining(seconds);
  }

  const sessionTotal = useMemo(() => sessionVolume(exercises), [exercises]);

  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    const seenKey = "active-workout:resumePromptSeen";
    if (sessionStorage.getItem(seenKey) === "1") return;

    const raw = localStorage.getItem("active-workout");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const state =
        parsed && typeof parsed === "object" && "state" in parsed
          ? (parsed as { state?: unknown }).state
          : null;

      const s = state && typeof state === "object" ? (state as Record<string, unknown>) : null;
      const hasPersistedSession =
        s &&
        typeof s === "object" &&
        typeof s.workoutPlanId === "string" &&
        s.workoutPlanId.length > 0 &&
        Array.isArray(s.exercises) &&
        s.exercises.length > 0;

      if (hasPersistedSession) {
        // Ustawiamy od razu, żeby popup nie wracał przy nawigacji między ekranami
        // (np. gdy użytkownik przejdzie na inną stronę zanim kliknie w modal).
        sessionStorage.setItem(seenKey, "1");
        setResumePromptOpen(true);
      }
    } catch {
      // ignore malformed storage; user can start fresh
    }
  }, []);

  useEffect(() => {
    if (restRemaining === null || restRemaining <= 0) return;
    const id = window.setInterval(() => {
      setRestRemaining((r) => {
        if (r === null || r <= 1) return null;
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [restRemaining]);

  const elapsed = useMemo(() => {
    const running =
      startedAt != null ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    return pausedElapsedSeconds + running;
  }, [now, startedAt, pausedElapsedSeconds]);

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

  function patchSet(exerciseId: string, setIndex: number, patch: Partial<{ reps: number | null; weight: number }>) {
    const ex = exercises.find((e) => e.id === exerciseId);
    const current = ex?.sets[setIndex];
    const wasDone = current?.done ?? false;

    patchSetInStore(exerciseId, setIndex, patch);

    // Start odpoczynku tylko przy przejściu false -> true (auto-done po wpisaniu danych).
    const nextReps = patch.reps !== undefined ? patch.reps : current?.reps ?? null;
    const nextWeight = patch.weight !== undefined ? patch.weight : current?.weight ?? 0;
    const isDoneNext =
      nextReps != null &&
      Number.isFinite(nextReps) &&
      nextReps > 0 &&
      Number.isFinite(nextWeight) &&
      nextWeight > 0;
    if (isDoneNext && !wasDone) {
      queueMicrotask(() => startRest(90));
    }
  }

  function addSet(exerciseId: string) {
    setExercises(
      exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              reps: last ? last.reps : null,
              weight: last ? last.weight : 0,
              done: false,
            },
          ],
        };
      }),
    );
  }

  function removeLastSet(exerciseId: string) {
    setExercises(
      exercises.map((ex) => {
        if (ex.id !== exerciseId) return ex;
        if (ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.slice(0, -1) };
      }),
    );
  }

  function beginWorkoutFromPlan(row: WorkoutPlanWithLastWorkoutDTO) {
    if (row.plan.exercises.length === 0) return;
    applyPlan(row.id, row.plan);
    const next = planExercisesToSession(row.plan.exercises);
    setExercises(next);
    setSelectedExerciseId(next[0]?.id ?? null);
    setSaveError(null);
    stopRest();
    start();
    if (entry === "start") {
      router.push("/active-workout");
    }
  }

  function stopRest() {
    setRestRemaining(null);
  }

  async function completeWorkout() {
    setSaveError(null);
    setSaving(true);
    try {
      // Prevent the `/active-workout` gate from overriding the redirect to `/reports`
      // after we reset the active session state.
      setSuppressRouteGate(true);

      const endedAt = Date.now();
      const baseSummary = {
        title: title.trim() || "Trening",
        endedAt,
        durationSeconds: elapsed,
        cardioMinutes,
        exercisesCount: exercises.length,
        setsDone: completedSets.done,
        setsTotal: completedSets.total,
        totalVolume: sessionTotal,
      };
      const res = await fetch("/api/workouts/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          startedAt: workoutStartedAtMs ?? startedAt ?? Date.now(),
          endedAt,
          cardioMinutes,
          exercises,
          workoutPlanId,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        strengthDeltaPercent?: number | null;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Nie udało się zapisać treningu");
      }
      reset();
      setExercises([]);
      setSelectedExerciseId(null);
      stopRest();
      const completedSummary = {
        ...baseSummary,
        strengthDeltaPercent:
          typeof data.strengthDeltaPercent === "number" && Number.isFinite(data.strengthDeltaPercent)
            ? data.strengthDeltaPercent
            : null,
      };
      sessionStorage.setItem("workout:completedSummary", JSON.stringify(completedSummary));
      router.push("/reports");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Nie udało się zapisać treningu");
      setSuppressRouteGate(false);
    } finally {
      setSaving(false);
    }
  }

  const exerciseList = (
    <GymPadSessionLayout
      title={title}
      elapsedSeconds={elapsed}
      exercises={exercises}
      selectedExerciseId={selectedExerciseId}
      onSelectExercise={(id) => setSelectedExerciseId(id)}
      onPatchSet={patchSet}
      onAddSet={addSet}
      onRemoveLastSet={removeLastSet}
    />
  );

  return (
    <div
      className={
        hasLoadedPlan
          ? "relative ml-[calc(50%-50vw)] w-screen max-w-[100vw] overflow-x-hidden bg-black pb-36 pt-0 sm:pb-40"
          : "relative min-h-[calc(100dvh-6rem)] rounded-2xl bg-[#0f0f0f] p-4 sm:p-6 lg:min-h-[calc(100dvh-5rem)]"
      }
    >
      {hasLoadedPlan ? (
        <Sheet>
          <PlanProgressHeader
            done={completedSets.done}
            total={completedSets.total}
            title={title}
            actionsSlot={
              <SheetTrigger
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/80 transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neon)]/40"
                aria-label="Ustawienia sesji"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </SheetTrigger>
            }
          />
          <SheetContent side="bottom" className="border-white/10 bg-[#0a0a0f] text-white">
            <SheetHeader>
              <SheetTitle className="text-white">Sesja — ustawienia</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              <div className="grid gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 justify-center gap-2 border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.07]"
                  onClick={() => router.push("/workout-history")}
                >
                  <ScrollText className="h-4 w-4" />
                  Historia treningów
                </Button>
                <div className="grid gap-2">
                  <Label className="text-white/80">Cardio (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={cardioMinutes}
                    onChange={(e) => setCardioMinutes(clampInt(Number(e.target.value), 0, 600))}
                    className="h-11 rounded-xl border-white/10 bg-white/[0.04] text-white"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 justify-center gap-2 border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.07]"
                  onClick={() => {
                    reset();
                    setExercises([]);
                    setSelectedExerciseId(null);
                    stopRest();
                  }}
                >
                  <RotateCcw className="h-4 w-4" />
                  Resetuj sesję
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {hasLoadedPlan ? (
        <RestTimerBar remaining={restRemaining} onStart={startRest} onStop={stopRest} />
      ) : null}

      <div
        className={
          hasLoadedPlan
            ? "mx-auto w-full max-w-[min(100%,720px)] px-4 pb-4 pt-2 sm:px-6"
            : "mx-auto max-w-[1400px]"
        }
      >
        <div
          className={
            hasLoadedPlan ? "grid gap-0" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:items-start"
          }
        >
          <ActiveSessionCard
            hasLoadedPlan={hasLoadedPlan}
            initialPlansEmpty={initialPlans.length === 0}
            emptyContent={
              entry === "active" ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 py-10 text-center">
                  <div className="rounded-2xl border border-white/[0.08] bg-[#111] p-6">
                    <RotateCcw className="mx-auto h-11 w-11 text-[#FF9500]" />
                  </div>
                  <div>
                    <p className="text-[17px] font-semibold text-white">Trening jest wyłączony</p>
                    <p className="mt-2 max-w-md text-[13px] text-white/45">
                      Nie możesz wejść do ekranu treningu bez aktywnej sesji.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button type="button" onClick={() => router.push("/start-workout")}>
                      Rozpocznij trening
                    </Button>
                    <Button type="button" variant="outline" onClick={() => router.push("/workout-plan")}>
                      Zobacz plany
                    </Button>
                  </div>
                </div>
              ) : undefined
            }
          >
            {hasLoadedPlan ? exerciseList : null}
          </ActiveSessionCard>

          {!hasLoadedPlan && entry === "start" ? (
            <motion.aside
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
              className="flex max-h-[min(88vh,900px)] flex-col gap-4 lg:sticky lg:top-4"
            >
              <div className="shrink-0 px-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  Biblioteka
                </p>
                <h2 className="font-heading mt-1 text-xl font-semibold text-white">Plany treningowe</h2>
                <p className="mt-1 text-xs leading-relaxed text-white/45">
                  Wybierz plan, aby wystartować sesję.
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/12">
                {initialPlans.length === 0 ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] p-4 text-sm text-white/55 backdrop-blur-[12px]"
                  >
                    Brak planów.{" "}
                    <Link
                      href="/workout-plan"
                      className="font-medium text-[#FF1A4B] underline-offset-2 hover:underline"
                    >
                      Utwórz plan
                    </Link>
                    .
                  </motion.p>
                ) : (
                  initialPlans.map((row, i) => {
                    const empty = row.plan.exercises.length === 0;
                    const active = workoutPlanId === row.id;
                    return (
                      <WorkoutPlanCard
                        key={row.id}
                        row={row}
                        index={i}
                        active={active}
                        empty={empty}
                        lastActivityLabel={formatLastWorkoutDate(row.lastWorkoutDate)}
                        onStart={() => beginWorkoutFromPlan(row)}
                        startLabel={active ? "Wczytaj ponownie" : "Rozpocznij trening"}
                      />
                    );
                  })
                )}
              </div>
            </motion.aside>
          ) : null}
        </div>
      </div>

      {hasLoadedPlan ? (
        <WorkoutSummary
          sessionTotal={sessionTotal}
          canComplete={hasLoadedPlan}
          saving={saving}
          onComplete={completeWorkout}
          saveError={saveError}
        />
      ) : null}

      {resumePromptOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Czy chcesz kontynuować trening?</CardTitle>
              <CardDescription>
                Wykryliśmy niedokończoną sesję. Twoje dane nie zostały utracone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-foreground/10 bg-muted/40 p-3 text-xs text-muted-foreground">
                Jeśli wybierzesz „Odrzuć”, usuniemy zapisany stan aktywnego treningu na tym urządzeniu.
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  sessionStorage.setItem("active-workout:resumePromptSeen", "1");
                  reset();
                  setExercises([]);
                  setSelectedExerciseId(null);
                  setRestRemaining(null);
                  setResumePromptOpen(false);
                }}
              >
                Odrzuć
              </Button>
              <Button
                type="button"
                onClick={() => {
                  sessionStorage.setItem("active-workout:resumePromptSeen", "1");
                  setResumePromptOpen(false);
                }}
              >
                Kontynuuj
              </Button>
            </CardFooter>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
