import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { workoutPlans } from "@/db/schema";
import {
  canEditWorkout,
  formatHistoryDayChip,
  workoutEditDeadlineMs,
} from "@/lib/workout-history-overview";
import {
  getCompletedWorkoutByIdForUser,
  getCompletedWorkoutsForUser,
} from "@/lib/workout-history";
import { normalizeWorkoutPlan } from "@/lib/workout-plan-utils";
import type { WorkoutPlanExercise } from "@/lib/workout-plan-types";
import {
  workoutPlanCompareKey,
  workoutPlanDisplayLabel,
} from "@/lib/workout-plan-compare-key";
import { WorkoutHistoryEditClient } from "@/components/workout-history/workout-history-edit-client";
import type { WorkoutExerciseState } from "@/components/workout/types";

export default async function WorkoutHistoryEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const w = await getCompletedWorkoutByIdForUser(userId, id);
  if (!w) return notFound();

  if (!canEditWorkout(w.endedAt, w.date)) {
    redirect(`/workout-history/${id}`);
  }

  const db = getDb();
  let planExercises: WorkoutPlanExercise[] = [];
  if (w.workoutPlanId) {
    const [planRow] = await db
      .select({ planJson: workoutPlans.planJson })
      .from(workoutPlans)
      .where(
        and(
          eq(workoutPlans.id, w.workoutPlanId),
          eq(workoutPlans.userId, userId),
        ),
      )
      .limit(1);
    if (planRow?.planJson) {
      try {
        const plan = normalizeWorkoutPlan(JSON.parse(planRow.planJson));
        planExercises = plan?.exercises ?? [];
      } catch {
        planExercises = [];
      }
    }
  }

  const planById = new Map(planExercises.map((e) => [e.id, e]));
  const planByName = new Map(
    planExercises.map((e) => [e.name.trim().toLowerCase(), e]),
  );

  const list = await getCompletedWorkoutsForUser(userId, { limit: 200 });
  const planKey = workoutPlanCompareKey({
    workoutPlanId: w.workoutPlanId,
    planName: w.planName,
    title: w.title,
  });
  const chronological = [...list]
    .filter((item) => {
      const key = workoutPlanCompareKey({
        workoutPlanId: item.workoutPlanId,
        planName: item.planName,
        title: item.title,
      });
      return key === planKey;
    })
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return (a.endedAt ?? a.startedAt ?? 0) - (b.endedAt ?? b.startedAt ?? 0);
    });
  const foundIdx = chronological.findIndex((item) => item.id === w.id);
  const planOccurrence = foundIdx >= 0 ? foundIdx + 1 : 1;

  const title =
    workoutPlanDisplayLabel({
      planName: w.planName,
      title: w.title,
    }) || w.title;

  const exercises: WorkoutExerciseState[] = w.exercises.map((ex) => {
    const fromPlan =
      planById.get(ex.id) ?? planByName.get(ex.name.trim().toLowerCase());
    const targetSets = ex.targetSets ?? fromPlan?.sets ?? Math.max(1, ex.sets.length);
    const targetReps = ex.targetReps ?? fromPlan?.reps ?? undefined;
    const targetRir = ex.targetRir ?? fromPlan?.rir ?? 1;
    const tempo = ex.tempo ?? fromPlan?.tempo ?? null;
    return {
      id: ex.id,
      name: ex.name,
      note: ex.note ?? undefined,
      targetSets,
      targetReps,
      targetRir,
      tempo,
      sets: ex.sets.map((s) => ({
        reps: s.reps,
        weight: s.weight,
        done: s.done,
        skipped: s.skipped,
        rir: s.rir ?? targetRir,
        rpe: null,
      })),
    };
  });

  return (
    <WorkoutHistoryEditClient
      initial={{
        id: w.id,
        title,
        date: w.date,
        planOccurrence,
        editDeadlineMs: workoutEditDeadlineMs(w.endedAt, w.date),
        weekdayLabel: formatHistoryDayChip(w.date).toUpperCase(),
        exercises,
      }}
    />
  );
}
