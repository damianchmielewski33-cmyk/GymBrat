import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getWorkoutHistoryOverview } from "@/lib/workout-history-overview";
import { WorkoutHistoryView } from "@/components/workout-history/workout-history-view";
import { DashboardRouteSkeleton } from "@/components/layout/dashboard-route-skeleton";

type PageProps = {
  searchParams?: Promise<{ plan?: string; open?: string }>;
};

export default async function WorkoutHistoryPage({ searchParams }: PageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const params = await (searchParams ??
    Promise.resolve({} as { plan?: string; open?: string }));
  const overview = await getWorkoutHistoryOverview(userId);

  return (
    <Suspense fallback={<DashboardRouteSkeleton />}>
      <WorkoutHistoryView
        overview={overview}
        initialPlanKey={params.plan ?? null}
        initialOpenId={params.open ?? null}
      />
    </Suspense>
  );
}
