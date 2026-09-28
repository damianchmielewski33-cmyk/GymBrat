"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  fetchLastWorkoutHintsForPlan,
  type WorkoutPlanWithLastWorkoutDTO,
} from "@/actions/workout-plan";
import { mergeHintsIntoExercises } from "@/lib/last-workout-hints";
import type { LastPlanHintsMap } from "@/lib/last-workout-hints";
import { ActiveSessionCard } from "@/components/active-workout/active-session-card";
import { GuidedWorkoutSession } from "@/components/active-workout/guided-workout-session";
import { StartWorkoutScreen } from "@/components/active-workout/start-workout-screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { sessionVolume } from "@/lib/workout-session-calculations";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { mapUnknownFetchError, UserMessages } from "@/lib/user-facing-errors";
import { submitCompletedWorkout } from "@/lib/workout-complete-submit";
import { planExercisesToSession } from "@/lib/session-from-plan";
import { countSessionSets } from "@/lib/session-cursor";
import { RotateCcw } from "lucide-react";

export function ActiveWorkoutView({
  initialPlans,
  entry = "active",
  userAiFeaturesDisabled: _userAiFeaturesDisabled = false,
  userAiEntitled: _userAiEntitled = true,
  display = "page",
}: {
  initialPlans: WorkoutPlanWithLastWorkoutDTO[];
  entry?: "active" | "start";
  userAiFeaturesDisabled?: boolean;
  userAiEntitled?: boolean;
  display?: "page" | "modal";
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
    setExercises,
    setSelectedExerciseId,
    patchSet: patchSetInStore,
  } = useActiveWorkoutStore();
  const [now, setNow] = useState(() => Date.now());
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lastPlanHints, setLastPlanHints] = useState<LastPlanHintsMap>({});
  const hintsMergedRef = useRef(false);
  const autostartDoneRef = useRef(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  const [suppressRouteGate, setSuppressRouteGate] = useState(false);
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

  useEffect(() => {
    if (display !== "page") return;
    if (suppressRouteGate || !storeHydrated) return;
    if (entry === "active" && !hasLoadedPlan) {
      router.replace("/start-workout");
      return;
    }
    if (entry === "start" && hasLoadedPlan) {
      router.replace("/active-workout");
    }
  }, [display, entry, hasLoadedPlan, router, suppressRouteGate, storeHydrated]);

  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
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
        sessionStorage.setItem(seenKey, "1");
        setResumePromptOpen(true);
      }
    } catch {
      // ignore malformed storage
    }
  }, [entry]);

  const elapsed = useMemo(() => {
    const running =
      startedAt != null ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    return pausedElapsedSeconds + running;
  }, [now, startedAt, pausedElapsedSeconds]);

  const completedSets = useMemo(() => countSessionSets(exercises), [exercises]);
  const sessionTotal = useMemo(() => sessionVolume(exercises), [exercises]);

  function beginWorkoutFromPlan(row: WorkoutPlanWithLastWorkoutDTO) {
    if (row.plan.exercises.length === 0) return;
    hintsMergedRef.current = false;
    applyPlan(row.id, row.plan);
    const next = planExercisesToSession(row.plan.exercises);
    setExercises(next);
    setSelectedExerciseId(next[0]?.id ?? null);
    setSaveError(null);
    start();
    if (entry === "start") {
      sessionStorage.setItem("active-workout:skipResumeOnce", "1");
    }
  }

  // Autostart z pulpitu: /start-workout?planId=…&autostart=1
  useEffect(() => {
    if (entry !== "start" || !storeHydrated || autostartDoneRef.current) return;
    if (hasLoadedPlan) return;
    const planId = searchParams.get("planId");
    const autostart = searchParams.get("autostart") === "1";
    if (!planId || !autostart) return;
    const row = initialPlans.find((p) => p.id === planId);
    if (!row || row.plan.exercises.length === 0) return;
    autostartDoneRef.current = true;
    beginWorkoutFromPlan(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once from query
  }, [entry, storeHydrated, hasLoadedPlan, searchParams, initialPlans]);

  async function completeWorkout() {
    setSaveError(null);
    setSaving(true);
    try {
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
      const result = await submitCompletedWorkout({
        title,
        startedAt: workoutStartedAtMs ?? startedAt ?? Date.now(),
        endedAt,
        cardioMinutes,
        exercises,
        workoutPlanId,
      });
      if (result.status === "error") {
        throw new Error(result.message);
      }
      reset();
      setExercises([]);
      setSelectedExerciseId(null);
      const completedSummary = {
        ...baseSummary,
        strengthDeltaPercent:
          result.status === "saved" ? result.strengthDeltaPercent : null,
      };
      sessionStorage.setItem("workout:completedSummary", JSON.stringify(completedSummary));
      if (result.status === "queued") {
        sessionStorage.setItem("gymbrat:workoutQueued", "1");
      } else {
        sessionStorage.removeItem("gymbrat:workoutQueued");
      }
      router.push(result.status === "queued" ? "/reports?queued=1" : "/reports");
    } catch (e) {
      setSaveError(mapUnknownFetchError(e, UserMessages.workoutSaveUnknown));
      setSuppressRouteGate(false);
    } finally {
      setSaving(false);
    }
  }

  function resetSession() {
    reset();
    setExercises([]);
    setSelectedExerciseId(null);
  }

  const startPlansContent =
    !hasLoadedPlan && entry === "start" ? (
      <StartWorkoutScreen
        plans={initialPlans}
        activePlanId={workoutPlanId}
        onBegin={beginWorkoutFromPlan}
      />
    ) : null;

  if (hasLoadedPlan) {
    return (
      <div className="relative bg-black">
        <GuidedWorkoutSession
          title={title}
          elapsedSeconds={elapsed}
          exercises={exercises}
          selectedExerciseId={selectedExerciseId}
          lastHints={lastPlanHints}
          saving={saving}
          saveError={saveError}
          onSelectExercise={setSelectedExerciseId}
          onPatchSet={(exerciseId, setIndex, patch) =>
            patchSetInStore(exerciseId, setIndex, patch)
          }
          onReset={resetSession}
          onComplete={completeWorkout}
        />

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
                  Jeśli wybierzesz „Odrzuć”, usuniemy zapisany stan aktywnego treningu na tym
                  urządzeniu.
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    sessionStorage.setItem("active-workout:resumePromptSeen", "1");
                    resetSession();
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

  return (
    <div className="relative min-h-[calc(100dvh-6rem)] rounded-2xl bg-[#0f0f0f] p-4 sm:p-6 lg:min-h-[calc(100dvh-5rem)]">
      <div className="mx-auto max-w-[1400px]">
        <ActiveSessionCard
          hasLoadedPlan={false}
          initialPlansEmpty={initialPlans.length === 0}
          emptyContent={
            entry === "start" ? (
              startPlansContent
            ) : !storeHydrated ? (
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/workout-plan")}
                  >
                    Zobacz plany
                  </Button>
                </div>
              </div>
            )
          }
        >
          {null}
        </ActiveSessionCard>
      </div>
    </div>
  );
}
