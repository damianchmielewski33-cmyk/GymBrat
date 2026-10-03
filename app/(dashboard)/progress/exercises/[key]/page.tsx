import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { ExerciseDetailView } from "@/components/progress/exercise-detail-view";
import { getExerciseProgressSeries } from "@/lib/exercise-progress";
import { decodeExerciseProgressKey } from "@/lib/progress-tabs";

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

  const data = await getExerciseProgressSeries({
    userId,
    exerciseQuery: name,
    days: 365,
  });

  const displayName = data.matchedExerciseNames[0] ?? name;

  return (
    <ExerciseDetailView
      name={displayName}
      points={data.points}
      prs={data.prs}
      intensity={data.intensity}
      metric={data.metric}
      matchedNames={data.matchedExerciseNames}
    />
  );
}
