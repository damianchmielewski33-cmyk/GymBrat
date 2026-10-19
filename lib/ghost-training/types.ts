export type GhostSourceKind = "self" | "friend" | "leader";

export type GhostCheckpoint = {
  elapsedSeconds: number;
  exerciseId: string;
  exerciseName: string;
  setIndex: number;
  cumulativeSets: number;
  cumulativeVolumeKg: number;
  weight: number;
  reps: number;
};

export type GhostTimeline = {
  sourceKind: GhostSourceKind;
  sourceUserId: string;
  sourceLabel: string;
  workoutId: string;
  planId: string | null;
  title: string;
  synthetic: boolean;
  checkpoints: GhostCheckpoint[];
  totalDurationSeconds: number;
  totalSets: number;
  totalVolumeKg: number;
};

export type GhostDelta = {
  timeDeltaSeconds: number;
  setsDelta: number;
  volumeDeltaKg: number;
  progressDeltaPct: number;
  ghostSetsDone: number;
  mySetsDone: number;
  ghostExerciseName: string | null;
  predicted: "winning" | "trailing" | "neck";
  predictedLabel: string;
};

export type GhostTargetOption = {
  kind: GhostSourceKind;
  userId: string;
  label: string;
  subtitle: string;
  workoutId?: string;
  planId?: string | null;
};
