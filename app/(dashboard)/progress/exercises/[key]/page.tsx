import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { ExerciseDetailView } from "@/components/progress/exercise-detail-view";
import { buildExercisePeriodCompares } from "@/lib/exercise-period-compare";
import { getExerciseProgressSeries } from "@/lib/exercise-progress";
import { decodeExerciseProgressKey } from "@/lib/progress-tabs";
import { withDbRetry } from "@/db/with-retry";

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

  const displayName = data.matchedExerciseNames[0] ?? name;
  const periodCompares = buildExercisePeriodCompares(data.points, data.metric);

  return (
    <ExerciseDetailView
      name={displayName}
      points={data.points}
      prs={data.prs}
      intensity={data.intensity}
      metric={data.metric}
      matchedNames={data.matchedExerciseNames}
      periodCompares={periodCompares}
    />
  );
}
