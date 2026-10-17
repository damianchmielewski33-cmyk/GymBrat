"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Users, X } from "lucide-react";
import { GroupWorkoutPresenceSync } from "@/components/community/group-workout-presence-sync";
import type { GroupWorkoutParticipantView } from "@/lib/community/group-workout-types";
import { useCommunityWorkoutStore } from "@/lib/stores/community-workout";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Live overlay — pokazuje **innych** z Team (nie siebie: swój progres jest w ekranie treningu).
 * Tap zwija do chipa, żeby nie zasłaniać serii.
 */
export function GroupWorkoutFloatingWidget() {
  const pathname = usePathname();
  const mode = useCommunityWorkoutStore((s) => s.mode);
  const teamName = useCommunityWorkoutStore((s) => s.teamName);
  const groupSessionId = useCommunityWorkoutStore((s) => s.groupSessionId);
  const hasSession = useActiveWorkoutStore(
    (s) => s.exercises.length > 0 && s.workoutStartedAtMs != null,
  );
  const [participants, setParticipants] = useState<
    GroupWorkoutParticipantView[]
  >([]);
  /** Na active-workout startujemy zwinięte — mniej zasłania ekran. */
  const onActiveWorkout = pathname.startsWith("/active-workout");
  const [expanded, setExpanded] = useState(!onActiveWorkout);

  useEffect(() => {
    if (onActiveWorkout) setExpanded(false);
  }, [onActiveWorkout, groupSessionId]);

  const onParticipants = useCallback((rows: GroupWorkoutParticipantView[]) => {
    setParticipants(rows);
  }, []);

  const show =
    mode === "group" &&
    !!groupSessionId &&
    hasSession &&
    (onActiveWorkout || pathname.startsWith("/community"));

  if (!show && mode !== "group") return null;

  /** Tylko partnerzy — siebie nie duplikujemy (widać w Active Workout). */
  const others = participants.filter((p) => !p.isSelf);
  const liveCount = others.length;

  return (
    <>
      {mode === "group" && groupSessionId ? (
        <GroupWorkoutPresenceSync onParticipants={onParticipants} />
      ) : null}

      {show ? (
        <div
          className={cn(
            "fixed z-[60] flex max-w-[min(100vw-1.5rem,20rem)] flex-col items-end gap-2",
            onActiveWorkout
              ? "right-3 top-[max(0.75rem,env(safe-area-inset-top))]"
              : "right-3 bottom-[calc(7.25rem+env(safe-area-inset-bottom))] md:right-5",
          )}
        >
          {!expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className={cn(
                "pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--gym-gold)]/35 bg-black/80 px-3.5 py-2.5",
                "text-[12px] font-semibold text-[var(--gym-gold)] shadow-lg backdrop-blur-xl",
                "transition hover:border-[var(--gym-gold)]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50",
              )}
              aria-expanded={false}
              aria-label={
                liveCount > 0
                  ? `Pokaż grupę na żywo, ${liveCount} osób trenuje`
                  : "Pokaż grupę na żywo"
              }
            >
              <Users className="h-4 w-4" aria-hidden />
              <span className="max-w-[9rem] truncate">
                {teamName ? `Grupa · ${teamName}` : "Grupa na żywo"}
              </span>
              <span className="rounded-full bg-[var(--gym-gold)]/20 px-1.5 py-0.5 font-metric text-[11px] tabular-nums text-[var(--gym-gold)]">
                {liveCount}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </button>
          ) : (
            <div
              className="pointer-events-auto w-[min(100vw-1.5rem,20rem)] overflow-hidden rounded-3xl border border-white/12 bg-black/85 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl"
              role="dialog"
              aria-label="Progres grupy na żywo"
            >
              <div className="flex items-center gap-2 border-b border-white/[0.08] px-3 py-2.5">
                <Users
                  className="h-4 w-4 shrink-0 text-[var(--gym-gold)]"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold uppercase tracking-wide text-[var(--gym-gold)]">
                    {teamName ? `Grupa · ${teamName}` : "Grupa na żywo"}
                  </p>
                  <p className="text-[11px] text-white/40">
                    {liveCount > 0
                      ? `${liveCount} ${liveCount === 1 ? "osoba trenuje" : "osób trenuje"}`
                      : "Czekamy na resztę…"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="touch-target inline-flex items-center justify-center rounded-xl text-white/55 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45"
                  aria-label="Zwiń panel grupy"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="max-h-[min(42vh,18rem)] space-y-2 overflow-y-auto overscroll-contain p-2.5">
                {others.length === 0 ? (
                  <p className="px-2 py-4 text-center text-[12px] leading-relaxed text-white/45">
                    Nikt inny jeszcze nie dołączył. Twój progres jest na ekranie
                    treningu — tu zobaczysz partnerów.
                  </p>
                ) : (
                  others.map((p) => {
                    const pr = p.presence;
                    return (
                      <div
                        key={p.userId}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-[11px] font-bold text-white/80"
                            aria-hidden
                          >
                            {initials(pr.displayName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-white">
                              {pr.displayName}
                            </p>
                            <p className="truncate text-[11px] text-white/50">
                              {pr.exerciseName}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-metric text-[13px] tabular-nums text-white/80">
                              {formatElapsed(pr.elapsedSeconds)}
                            </p>
                            <p className="text-[10px] text-white/40">
                              {pr.phase === "rest"
                                ? `Przerwa ${pr.restRemaining ?? 0}s`
                                : pr.phase === "done"
                                  ? "Koniec"
                                  : "Na żywo"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                          <div className="rounded-lg bg-black/30 px-1.5 py-1">
                            <p className="text-[9px] uppercase tracking-wide text-white/35">
                              Seria
                            </p>
                            <p className="font-metric text-[13px] text-white">
                              {pr.setIndex}/{pr.setTotal}
                            </p>
                          </div>
                          <div className="rounded-lg bg-black/30 px-1.5 py-1">
                            <p className="text-[9px] uppercase tracking-wide text-white/35">
                              Powt.
                            </p>
                            <p className="font-metric text-[13px] text-white">
                              {pr.reps ?? "—"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-black/30 px-1.5 py-1">
                            <p className="text-[9px] uppercase tracking-wide text-white/35">
                              kg
                            </p>
                            <p className="font-metric text-[13px] text-white">
                              {pr.weight > 0 ? pr.weight : "—"}
                            </p>
                          </div>
                        </div>

                        <div
                          className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                          role="progressbar"
                          aria-valuenow={pr.progressPercent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`Progres ${pr.displayName}`}
                        >
                          <div
                            className="h-full rounded-full bg-[var(--gym-gold)] transition-[width] duration-300"
                            style={{ width: `${pr.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
