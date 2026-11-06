import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { ExerciseDetailView } from "@/components/progress/exercise-detail-view";
import {
  classifyExerciseStagnation,
  predictExercise,
  type ExerciseSessionPoint,
} from "@/lib/analytics";
import { getExerciseProgressSeries } from "@/lib/exercise-progress";
import { calendarDateKey } from "@/lib/local-date";
import { decodeExerciseProgressKey } from "@/lib/progress-tabs";
import { withDbRetry } from "@/db/with-retry";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseFitnessGoalsJson } from "@/lib/fitness-goals";
import { resolveExerciseIdentity } from "@/lib/exercise-identity";

export const metadata = { title: "Ćwiczenie" };

export default async function ProgressExercisePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/progress");

  const { key } = await params;
  const name = decodeExerciseProgressKey(key);
  if (!name) notFound();

  // 730 dni — rok vs rok wymaga historii z poprzedniego roku
  const data = await withDbRetry(
    () =>
      getExerciseProgressSeries({
        userId,
        exerciseQuery: name,
        days: 730,
      }),
    { attempts: 3, label: "exercise-progress" },
  );

  const settingsRow = await withDbRetry(
    () =>
      getDb()
        .select({ fitnessGoalsJson: userSettings.fitnessGoalsJson })
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    { attempts: 2, label: "exercise-goals" },
  );
  const goals = parseFitnessGoalsJson(settingsRow?.fitnessGoalsJson ?? null);

  const displayName = data.matchedExerciseNames[0] ?? name;

  const sessionPoints: ExerciseSessionPoint[] = data.points.map((p) => ({
    date: p.date,
    volumeKg: p.tonnageKg,
    totalReps: p.totalReps,
    bestE1rm: p.bestE1rm,
    bestWeight: p.bestWeight,
    bestReps: p.bestReps,
    hardSets: 0,
    scoredSets: 0,
    avgRpe: p.avgRpe,
    avgRir: p.avgRir,
    setsCount: 0,
  }));
  const today = calendarDateKey();
  const prediction = predictExercise({
    exerciseKey: key,
    name: displayName,
    points: sessionPoints,
  });
  const stagnation = classifyExerciseStagnation({
    exerciseKey: key,
    name: displayName,
    points: sessionPoints,
    today,
  });

  const identityKey = resolveExerciseIdentity(displayName).key;
  const target =
    goals.exerciseTargets?.find((t) => {
      const k = resolveExerciseIdentity(t.name).key;
      return k && k === identityKey;
    }) ?? null;

  return (
    <ExerciseDetailView
      name={displayName}
      points={data.points}
      prs={data.prs}
      repRecords={data.repRecords}
      intensity={data.intensity}
      metric={data.metric}
      matchedNames={data.matchedExerciseNames}
      prediction={prediction}
      stagnation={stagnation}
      target={target}
    />
  );
}
