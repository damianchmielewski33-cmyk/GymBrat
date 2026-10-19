import type { GhostDelta, GhostTimeline } from "@/lib/ghost-training/types";
import { predictOutcome } from "@/lib/ghost-training/predict";

export function computeGhostDelta(input: {
  timeline: GhostTimeline;
  myElapsedSeconds: number;
  myCompletedSets: number;
  myVolumeKg: number;
  myProgressPct: number;
}): GhostDelta {
  const { timeline, myElapsedSeconds, myCompletedSets, myVolumeKg, myProgressPct } =
    input;
  const cps = timeline.checkpoints;

  const ghostAt = [...cps]
    .reverse()
    .find((c) => c.elapsedSeconds <= myElapsedSeconds);

  const ghostSetsDone = ghostAt?.cumulativeSets ?? 0;
  const ghostVolume = ghostAt?.cumulativeVolumeKg ?? 0;
  const ghostProgressPct =
    timeline.totalSets > 0
      ? Math.round((ghostSetsDone / timeline.totalSets) * 100)
      : 0;

  const ghostElapsedAtMySets =
    cps.find((c) => c.cumulativeSets >= myCompletedSets)?.elapsedSeconds ??
    timeline.totalDurationSeconds;

  const timeDeltaSeconds = Math.round(myElapsedSeconds - ghostElapsedAtMySets);
  const setsDelta = myCompletedSets - ghostSetsDone;
  const volumeDeltaKg = Math.round(myVolumeKg - ghostVolume);
  const progressDeltaPct = myProgressPct - ghostProgressPct;

  const predicted = predictOutcome({
    timeDeltaSeconds,
    setsDelta,
    progressDeltaPct,
    remainingGhostSets: Math.max(0, timeline.totalSets - ghostSetsDone),
    remainingMyEstimate: Math.max(0, timeline.totalSets - myCompletedSets),
  });

  return {
    timeDeltaSeconds,
    setsDelta,
    volumeDeltaKg,
    progressDeltaPct,
    ghostSetsDone,
    mySetsDone: myCompletedSets,
    ghostExerciseName: ghostAt?.exerciseName ?? null,
    predicted: predicted.kind,
    predictedLabel: predicted.label,
  };
}
