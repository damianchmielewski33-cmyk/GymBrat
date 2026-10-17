export type GroupWorkoutPhase = "working" | "rest" | "done";

export type GroupWorkoutPresence = {
  displayName: string;
  exerciseName: string;
  exerciseId: string | null;
  /** 1-based display index of current set */
  setIndex: number;
  setTotal: number;
  reps: number | null;
  weight: number;
  elapsedSeconds: number;
  restRemaining: number | null;
  /** 0–100 completed sets / all sets */
  progressPercent: number;
  phase: GroupWorkoutPhase;
};

export type GroupWorkoutParticipantView = {
  userId: string;
  status: string;
  updatedAt: number;
  presence: GroupWorkoutPresence;
  isSelf: boolean;
};

export type GroupTeamOption = {
  id: string;
  name: string;
  avatarEmoji: string;
  memberCount: number;
};

export function emptyPresence(displayName = "Zawodnik"): GroupWorkoutPresence {
  return {
    displayName,
    exerciseName: "—",
    exerciseId: null,
    setIndex: 1,
    setTotal: 1,
    reps: null,
    weight: 0,
    elapsedSeconds: 0,
    restRemaining: null,
    progressPercent: 0,
    phase: "working",
  };
}

export function parsePresence(raw: string): GroupWorkoutPresence {
  try {
    const o = JSON.parse(raw) as Partial<GroupWorkoutPresence>;
    return {
      displayName: String(o.displayName ?? "Zawodnik"),
      exerciseName: String(o.exerciseName ?? "—"),
      exerciseId: o.exerciseId ?? null,
      setIndex: Number(o.setIndex) || 1,
      setTotal: Number(o.setTotal) || 1,
      reps: o.reps == null ? null : Number(o.reps),
      weight: Number(o.weight) || 0,
      elapsedSeconds: Math.max(0, Number(o.elapsedSeconds) || 0),
      restRemaining:
        o.restRemaining == null ? null : Math.max(0, Number(o.restRemaining)),
      progressPercent: Math.min(100, Math.max(0, Number(o.progressPercent) || 0)),
      phase:
        o.phase === "rest" || o.phase === "done" || o.phase === "working"
          ? o.phase
          : "working",
    };
  } catch {
    return emptyPresence();
  }
}
