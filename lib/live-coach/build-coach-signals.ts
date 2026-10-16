/**
 * Orkiestracja silników → CoachSignals dla tip buildera.
 */

import type {
  WorkoutExerciseState,
  WorkoutSetState,
} from "@/components/workout/types";
import { computeConfidence, volumeConsistencyFromSessions } from "@/lib/live-coach/confidence";
import { buildE1rmTrendReport } from "@/lib/live-coach/e1rm-trend";
import {
  computeExerciseLocalFatigue,
  computeSessionFatigue,
} from "@/lib/live-coach/fatigue";
import {
  resolveEffectiveTargetRir,
  resolveMovementProfile,
} from "@/lib/live-coach/movement-profiles";
import { detectPersonalRecords } from "@/lib/live-coach/personal-records";
import { resolveProgressionBump } from "@/lib/live-coach/progression-bumps";
import {
  computeReadiness,
  lastCompletedRir,
} from "@/lib/live-coach/readiness";
import { fatigueDropSensitivityFromRest } from "@/lib/live-coach/rest-awareness";
import { detectSuspiciousSet } from "@/lib/live-coach/suspicious-data";
import type { CoachSignals, SessionSnapForTrends } from "@/lib/live-coach/types";
import {
  inferMovementKind,
} from "@/lib/exercise-movement-kind";
import { hasEffortConflict } from "@/lib/set-effort";
import { isCompletedWorkoutSet } from "@/lib/workout-skipped-sets";

function countHardStreak(sets: WorkoutSetState[], beforeIndex: number): number {
  let n = 0;
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (!isCompletedWorkoutSet(s)) break;
    const rir = s.rir;
    const rpe = s.rpe;
    const hard =
      (rir != null && rir <= 0) ||
      (rir == null && rpe != null && rpe >= 9);
    if (!hard) break;
    n += 1;
  }
  return n;
}

function countWarnStreak(sets: WorkoutSetState[], beforeIndex: number): number {
  let n = 0;
  for (let i = beforeIndex - 1; i >= 0; i--) {
    const s = sets[i]!;
    if (!isCompletedWorkoutSet(s)) break;
    const rir = s.rir;
    const rpe = s.rpe;
    const warn =
      (rir != null && rir <= 1) ||
      (rir == null && rpe != null && rpe >= 8);
    if (!warn) break;
    n += 1;
  }
  return n;
}

export type BuildCoachSignalsArgs = {
  exercise: WorkoutExerciseState;
  setIndex: number;
  /** Pełna lista ćwiczeń sesji — lepszy fatigue. */
  sessionExercises?: WorkoutExerciseState[];
  exerciseIndex?: number;
  durationMinutes?: number | null;
  /** Czy double progression pozwala na +kg (trailing easy itd.). */
  allowWeightBump?: boolean;
};

export function buildCoachSignals(args: BuildCoachSignalsArgs): CoachSignals {
  const { exercise, setIndex } = args;
  const ctx = exercise.coachContext ?? null;
  const profile = resolveMovementProfile(
    exercise.name || "",
    exercise.categoryId,
  );
  const effectiveTargetRir = resolveEffectiveTargetRir(
    exercise.targetRir,
    exercise.name || "",
    exercise.categoryId,
  );

  const recentSessions: SessionSnapForTrends[] =
    ctx?.recentSessions?.map((s) => ({
      topKg: s.topKg,
      bestReps: s.bestReps,
      bestE1rm: s.bestE1rm,
      avgRir: s.avgRir,
      volumeKg: s.volumeKg,
    })) ?? [];

  const e1rm =
    ctx?.e1rm != null
      ? {
          last: ctx.e1rm.last,
          avg: ctx.e1rm.avg,
          best: ctx.e1rm.best,
          trend4: ctx.e1rm.trend4,
          delta:
            ctx.e1rm.last != null &&
            recentSessions.length >= 2 &&
            recentSessions[recentSessions.length - 1]!.bestE1rm > 0
              ? ctx.e1rm.last -
                recentSessions[recentSessions.length - 1]!.bestE1rm
              : null,
          sessionCount: ctx.recentSessionCount ?? recentSessions.length,
        }
      : buildE1rmTrendReport(recentSessions);

  const fatigue =
    args.sessionExercises && args.sessionExercises.length > 0
      ? computeSessionFatigue({
          exercises: args.sessionExercises,
          exerciseIndex: args.exerciseIndex ?? 0,
          upToSetIndex: setIndex,
          durationMinutes: args.durationMinutes,
        })
      : computeExerciseLocalFatigue(exercise.sets, setIndex);

  const completedBefore = exercise.sets
    .slice(0, setIndex)
    .filter((s) => isCompletedWorkoutSet(s));
  const lastSet = completedBefore[completedBefore.length - 1] ?? null;
  const histLast =
    exercise.lastSessionSets?.[setIndex] ??
    exercise.lastSessionSets?.[exercise.lastSessionSets.length - 1] ??
    null;

  const probe = lastSet ?? histLast;
  const priorTop =
    recentSessions.length > 0
      ? Math.max(...recentSessions.map((s) => s.topKg))
      : ctx?.avgTopSetWeightKg ?? null;
  const priorE1 =
    e1rm.best ??
    (recentSessions.length > 1 ? recentSessions[1]?.bestE1rm : null);

  const prs = detectPersonalRecords({
    currentSets: completedBefore.length
      ? completedBefore
      : probe
        ? [probe]
        : [],
    baseline: ctx?.prs ?? null,
  });

  const suspicious = detectSuspiciousSet({
    weight: probe?.weight ?? 0,
    reps: probe?.reps ?? null,
    rir: probe?.rir,
    rpe: probe?.rpe,
    priorTopKg: priorTop,
    priorBestE1rm: priorE1,
    isWeightPr: prs.isWeightPr,
    isRepPr: prs.isRepPr,
  });

  const hardStreak = countHardStreak(exercise.sets, setIndex);
  const warnStreak = countWarnStreak(exercise.sets, setIndex);
  const lastRir = lastCompletedRir(exercise.sets, setIndex);

  const readiness = computeReadiness({
    lastRir: lastRir ?? histLast?.rir ?? null,
    recentSessions,
    e1rm,
    hardStreak,
    warnStreak,
    daysSinceLastSession: ctx?.daysSinceLastSession,
    stagnant: Boolean(ctx?.stagnant),
    fatigue,
    prs,
    restingHR: ctx?.restingHR,
    recoveryHR: ctx?.recoveryHR,
    heartRate: probe?.heartRate,
  });

  const hasConflict = probe
    ? hasEffortConflict({ rir: probe.rir, rpe: probe.rpe })
    : false;
  const missingEffort =
    !probe ||
    ((probe.rir == null || !Number.isFinite(probe.rir)) &&
      (probe.rpe == null || !Number.isFinite(probe.rpe) || probe.rpe <= 0));
  const missingLoad =
    !probe ||
    probe.weight <= 0 ||
    probe.reps == null ||
    probe.reps <= 0;

  const confidence = computeConfidence({
    recentSessionCount: ctx?.recentSessionCount ?? recentSessions.length,
    hasConflict,
    missingEffortData: missingEffort,
    missingWeightOrReps: missingLoad,
    suspicious,
    daysSinceLastSession: ctx?.daysSinceLastSession,
    e1rm,
    volumeConsistency: volumeConsistencyFromSessions(
      recentSessions.map((s) => s.volumeKg),
    ),
    fatigue,
    restingHR: ctx?.restingHR,
    recoveryHR: ctx?.recoveryHR,
  });

  const movementKind = inferMovementKind(
    exercise.name || "",
    exercise.categoryId,
  );
  const bump = resolveProgressionBump({
    readiness: readiness.score,
    confidence: confidence.score,
    movementKind,
    allowWeightBump: Boolean(args.allowWeightBump),
  });

  const restForNext =
    exercise.sets[setIndex]?.restSeconds ??
    lastSet?.restSeconds ??
    null;

  return {
    readiness,
    confidence,
    fatigue,
    e1rm,
    suspicious,
    prs,
    profile,
    bump,
    fatigueDropSensitivity: fatigueDropSensitivityFromRest(restForNext),
    effectiveTargetRir,
  };
}
