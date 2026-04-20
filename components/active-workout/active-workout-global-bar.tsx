"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pause, Play, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { cn } from "@/lib/utils";

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function ActiveWorkoutGlobalBar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    startedAt,
    pausedElapsedSeconds,
    workoutStartedAtMs,
    title,
    workoutPlanId,
    cardioMinutes,
    exercises,
    start,
    stopTimer,
    reset,
  } = useActiveWorkoutStore();

  const [now, setNow] = useState(() => Date.now());
  const [completing, setCompleting] = useState(false);

  const hasSession = workoutPlanId != null && exercises.length > 0;
  const isRunning = hasSession && startedAt != null;

  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isRunning]);

  const elapsedSeconds = useMemo(() => {
    const running = startedAt != null ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
    return pausedElapsedSeconds + running;
  }, [now, pausedElapsedSeconds, startedAt]);

  const progress = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const ex of exercises) {
      for (const set of ex.sets) {
        total += 1;
        if (set.done) done += 1;
      }
    }
    return { done, total };
  }, [exercises]);

  if (!hasSession) return null;

  const canNavigate = !pathname.startsWith("/active-workout");

  async function completeWorkoutFromBar() {
    if (completing) return;
    const ok = window.confirm("Zakończyć trening i zapisać do raportów?");
    if (!ok) return;

    setCompleting(true);
    try {
      const endedAt = Date.now();
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
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Nie udało się zapisać treningu");
      }
      reset();
      router.push("/reports");
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Nie udało się zapisać treningu");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] px-3 md:bottom-[calc(16px+env(safe-area-inset-bottom))]">
      <div
        className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl"
        style={{
          boxShadow: "0 10px 30px rgba(0,0,0,0.55), 0 0 0 1px rgba(230,0,35,0.10) inset",
        }}
      >
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
          {canNavigate ? (
            <Link
              href="/active-workout"
              className="min-w-0 flex-1 rounded-xl outline-none transition hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--neon)]/40"
              aria-label="Przejdź do aktywnego treningu"
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
                    <span className="shrink-0 text-xs text-white/45">
                      • {progress.done}/{progress.total}
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-[11px] text-white/45">
                  Masz aktywny trening — kliknij, aby wrócić
                </p>
              </div>
            </Link>
          ) : (
            <div className="min-w-0 flex-1">
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
                  <span className="shrink-0 text-xs text-white/45">
                    • {progress.done}/{progress.total}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-[11px] text-white/45">
                Jesteś w widoku treningu
              </p>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              className="gap-2 bg-[#FF1A4B] text-white hover:bg-[#e61645] disabled:opacity-50"
              disabled={completing}
              onClick={completeWorkoutFromBar}
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {completing ? "Zapisywanie…" : "Zakończ trening"}
              </span>
            </Button>

            <Link
              href="/active-workout"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "hidden sm:inline-flex",
              )}
            >
              Wróć
            </Link>

            <Button
              type="button"
              variant="outline"
              className="gap-2 border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.07]"
              onClick={() => (isRunning ? stopTimer() : start())}
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span className="hidden sm:inline">{isRunning ? "Pauza" : "Wznów"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="gap-2 border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.07]"
              onClick={() => {
                const ok = window.confirm(
                  "Odrzucić aktywny trening? Dane tej sesji zostaną usunięte z urządzenia.",
                );
                if (!ok) return;
                reset();
              }}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Odrzuć</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

