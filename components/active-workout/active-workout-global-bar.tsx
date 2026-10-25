"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Pause, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { cn } from "@/lib/utils";
import { requestActiveWorkoutCloudPush } from "@/lib/active-workout-persist";
import { hapticTap } from "@/lib/haptics";
import { unlockDocumentInteraction } from "@/lib/unlock-document-interaction";
import { useWorkoutFinishFlow } from "@/components/active-workout/use-workout-finish-flow";
import { WorkoutFinishConfirmDialog } from "@/components/active-workout/workout-finish-confirm-dialog";
import { WorkoutAllSetsDoneDialog } from "@/components/active-workout/workout-all-sets-done-dialog";
import { WorkoutDiscardSessionDialog } from "@/components/active-workout/workout-discard-session-dialog";
import { WorkoutSavingScreen } from "@/components/active-workout/workout-saving-screen";
import { WorkoutFinishedScreen } from "@/components/active-workout/workout-finished-screen";
import { countSetsDone } from "@/lib/workout-session-progress";

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/**
 * Pasek globalny (poza `/active-workout`). Od ADR 0004 p.4/8 używa wspólnego hooka
 * zakończenia — ten sam dialog pominiętych, ekran zapisu i ekran końcowy jak na
 * ekranie sesji, złoty CTA (bez czerwieni z dawnego przycisku), bez własnego `window.alert`.
 */
export function ActiveWorkoutGlobalBar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    startedAt,
    pausedElapsedSeconds,
    title,
    workoutPlanId,
    exercises,
    start,
    stopTimer,
    reset,
    hideGlobalBarForRoute,
    setHideGlobalBarForRoute,
  } = useActiveWorkoutStore();

  const flow = useWorkoutFinishFlow();
  const [now, setNow] = useState(() => Date.now());
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const hasSession = workoutPlanId != null && exercises.length > 0;
  const isRunning = hasSession && startedAt != null;
  const onActiveWorkout = pathname.startsWith("/active-workout");

  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isRunning]);

  useEffect(() => {
    if (onActiveWorkout) {
      setHideGlobalBarForRoute(false);
      // Dialog / scroll-lock z paska nie może zostać po wejściu na pełny ekran treningu.
      setConfirmCompleteOpen(false);
      setConfirmDiscardOpen(false);
      unlockDocumentInteraction();
      return;
    }
    if (!hideGlobalBarForRoute) return;
    const t = window.setTimeout(() => setHideGlobalBarForRoute(false), 10_000);
    return () => window.clearTimeout(t);
  }, [hideGlobalBarForRoute, onActiveWorkout, setHideGlobalBarForRoute]);

  const elapsedSeconds = useMemo(() => {
    const running = startedAt != null ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    return pausedElapsedSeconds + running;
  }, [now, pausedElapsedSeconds, startedAt]);

  const progress = useMemo(() => countSetsDone(exercises), [exercises]);

  // Ekran główny (`/active-workout`) renderuje własne dialogi/ekrany tego samego hooka.
  if (onActiveWorkout) return null;
  // Nic do pokazania: brak sesji i przepływ zakończenia bezczynny.
  if (!hasSession && flow.state.phase === "idle") return null;

  const showBar = hasSession && !hideGlobalBarForRoute;

  return (
    <>
      {showBar ? (
        <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] px-3 md:bottom-[calc(16px+env(safe-area-inset-bottom))]">
          <div
            className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl"
            style={{
              boxShadow: "0 10px 30px rgba(0,0,0,0.55), 0 0 0 1px rgba(var(--neon-rgb),0.10) inset",
            }}
          >
            <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
              <button
                type="button"
                className="min-w-0 flex-1 rounded-xl text-left outline-none transition hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--neon)]/40"
                aria-label="Kontynuuj trening"
                onClick={() => {
                  hapticTap();
                  unlockDocumentInteraction();
                  router.push("/active-workout");
                }}
              >
                <div className="min-w-0 px-1 py-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isRunning ? "bg-[var(--neon)]" : "bg-white/35",
                      )}
                      aria-hidden
                    />
                    <p className="truncate text-sm font-semibold text-white/90">
                      {title || "Trening"}
                    </p>
                    <span className="shrink-0 text-xs text-white/50">
                      {formatDuration(elapsedSeconds)}
                    </span>
                    {progress.total > 0 ? (
                      <span className="shrink-0 text-xs text-[var(--gym-text-secondary)]">
                        • {progress.done}/{progress.total}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[11px] text-[var(--gym-text-secondary)]">
                    Kontynuuj trening — wróć do sesji
                  </p>
                </div>
              </button>

              <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                <Button
                  type="button"
                  variant="cta"
                  className="gap-2"
                  disabled={flow.state.phase === "saving"}
                  aria-label={flow.state.phase === "saving" ? "Zapisuję…" : "Zakończ trening"}
                  onClick={() => {
                    hapticTap();
                    flow.requestFinishFromSecondaryEntry(() => setConfirmCompleteOpen(true));
                  }}
                >
                  <Check className="h-4 w-4" />
                  <span aria-hidden="true">
                    {flow.state.phase === "saving" ? "Zapisuję…" : "Zakończ"}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    hapticTap();
                    unlockDocumentInteraction();
                    router.push("/active-workout");
                  }}
                >
                  Kontynuuj
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.07]"
                  aria-label={isRunning ? "Pauza" : "Wznów"}
                  onClick={() => (isRunning ? stopTimer() : start())}
                >
                  {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span className="hidden sm:inline" aria-hidden="true">
                    {isRunning ? "Pauza" : "Wznów"}
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2"
                  aria-label="Odrzuć"
                  onClick={() => setConfirmDiscardOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline" aria-hidden="true">
                    Odrzuć
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <WorkoutFinishConfirmDialog
        open={confirmCompleteOpen}
        onOpenChange={setConfirmCompleteOpen}
        busy={flow.state.phase === "saving"}
        onConfirm={flow.requestFinish}
      />

      {flow.state.phase === "skipped-dialog" ? (
        <WorkoutAllSetsDoneDialog
          open
          onOpenChange={() => {
            /* Esc/outside — dialog sam woła `onGoToSkipped` (patrz implementacja). */
          }}
          onFinish={flow.confirmFinishFromDialog}
          onGoToSkipped={flow.goToSkippedTarget}
          target={flow.state.target}
          skippedCount={flow.state.skippedCount}
          incompleteCount={flow.state.incompleteCount}
          zeroCompleted={progress.done - flow.state.skippedCount <= 0}
        />
      ) : null}

      {flow.state.phase === "saving" || flow.state.phase === "error" ? (
        <WorkoutSavingScreen
          phase={flow.state.phase}
          errorMessage={flow.state.phase === "error" ? flow.state.message : undefined}
          onRetry={flow.retry}
          onReturnToWorkout={flow.returnToWorkout}
        />
      ) : null}

      {flow.state.phase === "done" ? (
        <WorkoutFinishedScreen data={flow.state.result} onClose={flow.close} />
      ) : null}

      <WorkoutDiscardSessionDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
        onConfirm={() => {
          reset();
          requestActiveWorkoutCloudPush(true);
        }}
      />
    </>
  );
}
