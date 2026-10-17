"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
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

  const onParticipants = useCallback((rows: GroupWorkoutParticipantView[]) => {
    setParticipants(rows);
  }, []);

  const onActiveWorkout = pathname.startsWith("/active-workout");
  const show =
    mode === "group" &&
    !!groupSessionId &&
    hasSession &&
    (onActiveWorkout || pathname.startsWith("/community"));

  if (!show && mode !== "group") return null;

  const others = participants.filter((p) => !p.isSelf);
  const self = participants.find((p) => p.isSelf);

  return (
    <>
      {mode === "group" && groupSessionId ? (
        <GroupWorkoutPresenceSync onParticipants={onParticipants} />
      ) : null}

      {show ? (
        <div
          className={cn(
            "pointer-events-none fixed z-[60] flex max-w-[min(100vw-1.5rem,22rem)] flex-col gap-2",
            onActiveWorkout
              ? "right-3 top-[max(0.75rem,env(safe-area-inset-top))]"
              : "right-3 bottom-[calc(7.25rem+env(safe-area-inset-bottom))] md:right-5",
          )}
          aria-live="polite"
        >
          {teamName ? (
            <p className="pointer-events-none self-end rounded-full border border-[var(--gym-gold)]/30 bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--gym-gold)] backdrop-blur-md">
              Team · {teamName}
            </p>
          ) : null}

          <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
            {[self, ...others].filter(Boolean).map((p) => {
              if (!p) return null;
              const pr = p.presence;
              return (
                <div
                  key={p.userId}
                  className={cn(
                    "pointer-events-auto rounded-2xl border px-3 py-2.5 shadow-lg backdrop-blur-xl",
                    p.isSelf
                      ? "border-[var(--gym-gold)]/35 bg-black/75"
                      : "border-white/12 bg-black/70",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                        p.isSelf
                          ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                          : "border-white/15 bg-white/[0.06] text-white/80",
                      )}
                      aria-hidden
                    >
                      {initials(pr.displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-white">
                        {pr.displayName}
                        {p.isSelf ? " (Ty)" : ""}
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
                          ? `Rest ${pr.restRemaining ?? 0}s`
                          : pr.phase === "done"
                            ? "Done"
                            : "Live"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-lg bg-white/[0.04] px-1.5 py-1">
                      <p className="text-[9px] uppercase tracking-wide text-white/35">
                        Seria
                      </p>
                      <p className="font-metric text-[13px] text-white">
                        {pr.setIndex}/{pr.setTotal}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/[0.04] px-1.5 py-1">
                      <p className="text-[9px] uppercase tracking-wide text-white/35">
                        Powt.
                      </p>
                      <p className="font-metric text-[13px] text-white">
                        {pr.reps ?? "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/[0.04] px-1.5 py-1">
                      <p className="text-[9px] uppercase tracking-wide text-white/35">
                        kg
                      </p>
                      <p className="font-metric text-[13px] text-white">
                        {pr.weight > 0 ? pr.weight : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--gym-gold)] transition-[width] duration-300"
                      style={{ width: `${pr.progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[10px] tabular-nums text-white/40">
                    {pr.progressPercent}%
                  </p>
                </div>
              );
            })}

            {others.length === 0 && self ? (
              <p className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-[11px] text-white/45 backdrop-blur-md">
                Czekamy na resztę Team…
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
