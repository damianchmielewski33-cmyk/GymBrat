"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/haptics";
import { unlockDocumentInteraction } from "@/lib/unlock-document-interaction";
import { shouldShowGlobalWorkoutBar } from "@/lib/global-workout-bar";
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
 * Mini-pasek niedokończonego treningu (poza `/active-workout` i `/treningi`).
 * US13 / Z63: jeden wąski wiersz i jedna akcja — powrót do sesji. Zakończenie,
 * pauza i porzucenie są w sesji (menu) oraz na karcie „Niedokończony trening”
 * na ekranie Treningi, więc pasek nie dubluje sterowania ani nie zasłania narzędzi.
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
    hideGlobalBarForRoute,
    setHideGlobalBarForRoute,
  } = useActiveWorkoutStore();

  const [now, setNow] = useState(() => Date.now());

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

  if (
    !shouldShowGlobalWorkoutBar({
      pathname,
      hasSession,
      hiddenForRoute: hideGlobalBarForRoute,
    })
  ) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] px-3 md:bottom-[calc(16px+env(safe-area-inset-bottom))]">
      <button
        type="button"
        aria-label={`Wróć do treningu: ${title || "Trening"}, ${formatDuration(elapsedSeconds)}`}
        className="mx-auto flex h-11 w-full max-w-6xl items-center gap-2 rounded-2xl border border-white/10 bg-zinc-950/85 px-3 text-left backdrop-blur-xl outline-none transition hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-[var(--neon)]/40"
        style={{
          boxShadow: "0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(var(--neon-rgb),0.10) inset",
        }}
        onClick={() => {
          hapticTap();
          unlockDocumentInteraction();
          router.push("/active-workout");
        }}
      >
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            isRunning ? "bg-[var(--neon)]" : "bg-white/35",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">
          {title || "Trening"}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-white/50" aria-hidden>
          {formatDuration(elapsedSeconds)}
          {progress.total > 0 ? ` • ${progress.done}/${progress.total}` : ""}
        </span>
        <span
          className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-[var(--gym-gold)]"
          aria-hidden
        >
          Wróć
          <ChevronRight className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
