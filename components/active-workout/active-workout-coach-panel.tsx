"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activeWorkoutCoachAction,
  type ActiveWorkoutCoachTrigger,
} from "@/actions/active-workout-coach";
import type { WorkoutExerciseState } from "@/components/workout/types";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";

type Props = {
  title: string;
  elapsedSeconds: number;
  exercises: WorkoutExerciseState[];
  selectedExerciseId: string | null;
  restRemaining: number | null;
  userAiFeaturesDisabled?: boolean;
};

function serializeExercises(exercises: WorkoutExerciseState[]) {
  return exercises.map((e) => ({
    id: e.id,
    name: e.name,
    sets: e.sets.map((s) => ({
      reps: s.reps ?? null,
      weight: Number.isFinite(s.weight) ? s.weight : 0,
      done: Boolean(s.done),
    })),
  }));
}

export function ActiveWorkoutCoachPanel({
  title,
  elapsedSeconds,
  exercises,
  selectedExerciseId,
  restRemaining,
  userAiFeaturesDisabled = false,
}: Props) {
  const [text, setText] = useState<string | null>(null);
  const [source, setSource] = useState<"ai" | "heuristic" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);
  const tipRequestId = useRef(0);
  const prevRest = useRef<number | null>(null);
  const prevDoneCount = useRef<number | null>(null);
  const setDoneTimer = useRef<number | null>(null);

  const COACH_ACTION_TIMEOUT_MS = 28_000;

  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error("timeout")), ms);
      promise
        .then((v) => {
          window.clearTimeout(t);
          resolve(v);
        })
        .catch((e) => {
          window.clearTimeout(t);
          reject(e);
        });
    });
  }

  const payloadRef = useRef({
    title,
    elapsedSeconds,
    exercises,
    selectedExerciseId,
    restRemaining,
  });
  payloadRef.current = {
    title,
    elapsedSeconds,
    exercises,
    selectedExerciseId,
    restRemaining,
  };

  const currentDoneCount = useMemo(() => {
    const ex =
      exercises.find((e) => e.id === selectedExerciseId) ?? exercises[0] ?? null;
    if (!ex) return 0;
    return ex.sets.filter((s) => s.done).length;
  }, [exercises, selectedExerciseId]);

  const requestTip = useCallback(async (trigger: ActiveWorkoutCoachTrigger) => {
    const p = payloadRef.current;
    if (p.exercises.length === 0 || inFlight.current) return;
    const myId = ++tipRequestId.current;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const r = await withTimeout(
        activeWorkoutCoachAction({
          title: p.title,
          elapsedSeconds: Math.round(p.elapsedSeconds),
          selectedExerciseId: p.selectedExerciseId,
          exercises: serializeExercises(p.exercises),
          restRemaining: p.restRemaining,
          trigger,
        }),
        COACH_ACTION_TIMEOUT_MS,
      );
      if (myId !== tipRequestId.current) return;
      if (r.ok) {
        setText(r.text);
        setSource(r.source);
      } else {
        setError(r.error);
      }
    } catch (e) {
      if (myId !== tipRequestId.current) return;
      setError(
        e instanceof Error && e.message === "timeout"
          ? "Trener AI nie odpowiedział na czas. Spróbuj „Odśwież” za chwilę."
          : "Nie udało się połączyć z trenerem AI.",
      );
    } finally {
      if (myId === tipRequestId.current) {
        setLoading(false);
        inFlight.current = false;
      }
    }
  }, []);

  // Start + zmiana aktywnego ćwiczenia (zakładka)
  useEffect(() => {
    if (exercises.length === 0) return;
    const t = window.setTimeout(() => void requestTip("exercise_change"), 450);
    return () => window.clearTimeout(t);
  }, [selectedExerciseId, exercises.length, requestTip]);

  // Start przerwy
  useEffect(() => {
    const r = restRemaining;
    const was = prevRest.current;
    prevRest.current = r;
    if (r != null && r > 0 && (was == null || was <= 0)) {
      void requestTip("rest_start");
    }
  }, [restRemaining, requestTip]);

  useEffect(() => {
    prevDoneCount.current = null;
  }, [selectedExerciseId]);

  // Ukończona seria (licznik „done” w bieżącym ćwiczeniu rośnie)
  useEffect(() => {
    if (exercises.length === 0) return;
    const prev = prevDoneCount.current;
    prevDoneCount.current = currentDoneCount;
    if (prev == null) return;
    if (currentDoneCount <= prev) return;

    if (setDoneTimer.current) window.clearTimeout(setDoneTimer.current);
    setDoneTimer.current = window.setTimeout(() => {
      void requestTip("set_done");
    }, 900);
    return () => {
      if (setDoneTimer.current != null) window.clearTimeout(setDoneTimer.current);
    };
  }, [currentDoneCount, exercises.length, requestTip]);

  return (
    <div className="mb-4 rounded-2xl border border-[var(--neon)]/25 bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--neon)]/35 bg-[var(--neon)]/10">
          <MessageCircle className="h-5 w-5 text-[var(--neon)]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                Trener AI
              </p>
              <p className="font-heading text-base font-semibold text-white">Rady na żywo</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || exercises.length === 0}
              onClick={() => void requestTip("manual")}
              className="h-8 shrink-0 gap-1.5 border-white/15 bg-white/[0.04] text-xs text-white hover:bg-white/[0.08]"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              Odśwież
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-amber-200/90">{error}</p>
          ) : text ? (
            <>
              <p className="text-sm leading-relaxed text-white/85">{text}</p>
              <p className="text-[11px] text-white/40">
                {source === "ai"
                  ? "Na podstawie Twojej bieżącej sesji i danych z aplikacji."
                  : userAiFeaturesDisabled
                    ? "Wyłączyłeś funkcje AI w profilu — bez modelu, tylko skrót z bieżącej sesji."
                    : "Tryb offline / bez AI — krótki skrypt z Twojej sesji. Włącz dostawcę AI, aby dostać pełniejsze podpowiedzi."}
              </p>
            </>
          ) : loading ? (
            <p className="flex items-center gap-2 text-sm text-white/55">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
              Trener AI przygotowuje wskazówkę…
            </p>
          ) : (
            <p className="text-sm text-white/50">Ładowanie wskazówki…</p>
          )}
        </div>
      </div>
    </div>
  );
}
