import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { ExerciseDetailView } from "@/components/progress/exercise-detail-view";
import {
  classifyExerciseStagnation,
  predictExercise,
  type ExerciseSessionPoint,
} from "@/lib/analytics";
import { buildExercisePeriodCompares } from "@/lib/exercise-period-compare";
import { getExerciseProgressSeries } from "@/lib/exercise-progress";
import { calendarDateKey } from "@/lib/local-date";
import { decodeExerciseProgressKey } from "@/lib/progress-tabs";
import { withDbRetry } from "@/db/with-retry";

export default async function ProgressExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ okres?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/progress");

  const { key } = await params;
  const query = await searchParams;
  const rawPeriod = Array.isArray(query?.okres) ? query.okres[0] : query?.okres;
  const initialPeriod = rawPeriod === "7" || rawPeriod === "90" || rawPeriod === "all" ? rawPeriod : "30";
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

  const displayName = data.matchedExerciseNames[0] ?? name;
  const periodCompares = buildExercisePeriodCompares(data.points, data.metric);

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

  return (
    <ExerciseDetailView
      name={displayName}
      points={data.points}
      prs={data.prs}
      intensity={data.intensity}
      metric={data.metric}
      matchedNames={data.matchedExerciseNames}
      periodCompares={periodCompares}
      prediction={prediction}
      stagnation={stagnation}
      initialPeriod={initialPeriod}
    />
  );
}
