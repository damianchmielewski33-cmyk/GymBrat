"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  fetchLastWorkoutHintsForPlan,
  type WorkoutPlanWithLastWorkoutDTO,
} from "@/actions/workout-plan";
import { mergeHintsIntoExercises } from "@/lib/last-workout-hints";
import type { LastPlanHintsMap } from "@/lib/last-workout-hints";
import { ActiveSessionCard } from "@/components/active-workout/active-session-card";
import { GymPadSessionLayout } from "@/components/active-workout/gympad-session-layout";
import { PlanProgressHeader } from "@/components/active-workout/plan-progress-header";
import { StartWorkoutScreen } from "@/components/active-workout/start-workout-screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RestTimerBar } from "@/components/workout/RestTimerBar";
import { readRestTimerPrefs } from "@/lib/rest-timer-prefs";
import { playRestTimerEndSignal } from "@/lib/rest-timer-signal";
import type { WorkoutExerciseState } from "@/components/workout/types";
import { WorkoutSummary } from "@/components/workout/WorkoutSummary";
import type { WorkoutPlanExercise } from "@/lib/workout-plan-types";
import { sessionVolume } from "@/lib/workout-session-calculations";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
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
      rpe: null,
    })),
  }));
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
    patchExercise,
  } = useActiveWorkoutStore();
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  const [lastPlanHints, setLastPlanHints] = useState<LastPlanHintsMap>({});
  const hintsMergedRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [suppressRouteGate, setSuppressRouteGate] = useState(false);
  /** Bez tego pierwszy render `/active-workout` widzi pusty stan zanim wczyta się localStorage → fałszywy redirect na `/start-workout`. */
  const [storeHydrated, setStoreHydrated] = useState(false);

  const hasLoadedPlan = workoutPlanId != null && exercises.length > 0;

  useLayoutEffect(() => {
    const api = useActiveWorkoutStore.persist;
    if (api.hasHydrated()) {
      setStoreHydrated(true);
      return;
    }
    const unsub = api.onFinishHydration(() => setStoreHydrated(true));
    return unsub;
  }, []);

  useEffect(() => {
    hintsMergedRef.current = false;
  }, [workoutPlanId]);

  useEffect(() => {
    if (!workoutPlanId) {
      setLastPlanHints({});
      return;
    }
    let cancelled = false;
    void fetchLastWorkoutHintsForPlan(workoutPlanId).then((h) => {
      if (!cancelled) setLastPlanHints(h);
    });
    return () => {
      cancelled = true;
    };
  }, [workoutPlanId]);

  useEffect(() => {
    if (!workoutPlanId || hintsMergedRef.current) return;
    const ex = useActiveWorkoutStore.getState().exercises;
    if (!ex.length) return;
    if (!Object.keys(lastPlanHints).length) {
      hintsMergedRef.current = true;
      return;
    }
    setExercises(mergeHintsIntoExercises(ex, lastPlanHints));
    hintsMergedRef.current = true;
  }, [lastPlanHints, workoutPlanId, setExercises]);

  // Route gating:
  // - `/active-workout` is a strict "session view" and must NOT be accessible without an active session.
  // - `/start-workout` is the entry point that lets user pick a plan and begin a session.
  useEffect(() => {
    if (suppressRouteGate || !storeHydrated) return;
    if (entry === "active" && !hasLoadedPlan) {
      router.replace("/start-workout");
      return;
    }
    if (entry === "start" && hasLoadedPlan) {
      router.replace("/active-workout");
    }
  }, [entry, hasLoadedPlan, router, suppressRouteGate, storeHydrated]);

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
    /** Na ekranie wyboru planu nie pytamy o wznowienie — użytkownik świadomie zaczyna ścieżkę treningu. */
    if (entry === "start") return;

    const skipOnceKey = "active-workout:skipResumeOnce";
    if (sessionStorage.getItem(skipOnceKey) === "1") {
      sessionStorage.removeItem(skipOnceKey);
      return;
    }

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
  }, [entry]);

  useEffect(() => {
    if (restRemaining === null || restRemaining <= 0) return;
    const id = window.setInterval(() => {
      setRestRemaining((r) => {
        if (r === null) return null;
        if (r <= 1) {
          if (r === 1) {
            queueMicrotask(() => playRestTimerEndSignal());
          }
          return null;
        }
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
      const { autoStart, defaultSeconds } = readRestTimerPrefs();
      if (autoStart) {
        queueMicrotask(() => startRest(defaultSeconds));
      }
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
              rpe: last?.rpe ?? null,
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
    hintsMergedRef.current = false;
    applyPlan(row.id, row.plan);
    const next = planExercisesToSession(row.plan.exercises);
    setExercises(next);
    setSelectedExerciseId(next[0]?.id ?? null);
    setSaveError(null);
    stopRest();
    start();
    if (entry === "start") {
      sessionStorage.setItem("active-workout:skipResumeOnce", "1");
      /** Nawigacja: wyłącznie efekt „route gate” (`start` + `hasLoadedPlan` → `replace`), żeby uniknąć podwójnego push/replace i wyścigów z hydracją. */
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
      await ensureCsrfCookie();
      const res = await fetch("/api/workouts/complete", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          ...getXsrfHeaders(),
        },
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
      lastHints={lastPlanHints}
      onExerciseNoteChange={(exerciseId, note) =>
        patchExercise(exerciseId, { note })
      }
    />
  );

  const startPlansContent =
    !hasLoadedPlan && entry === "start" ? (
      <StartWorkoutScreen
        plans={initialPlans}
        activePlanId={workoutPlanId}
        onBegin={beginWorkoutFromPlan}
      />
    ) : null;

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
        <div className={hasLoadedPlan ? "grid gap-0" : ""}>
          <ActiveSessionCard
            hasLoadedPlan={hasLoadedPlan}
            initialPlansEmpty={initialPlans.length === 0}
            emptyContent={
              entry === "start" ? (
                startPlansContent
              ) : (
              entry === "active" ? (
                !storeHydrated ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-16 text-center">
                    <div className="h-9 w-9 animate-pulse rounded-full bg-white/[0.08]" />
                    <p className="text-sm text-white/45">Wczytywanie sesji…</p>
                  </div>
                ) : (
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
                )
              ) : undefined
              )
            }
          >
            {hasLoadedPlan ? exerciseList : null}
          </ActiveSessionCard>
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
