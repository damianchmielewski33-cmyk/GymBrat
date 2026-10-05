import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardRouteSkeleton } from "@/components/layout/dashboard-route-skeleton";
import { WorkoutPlanPageContent } from "@/components/treningi/workout-plan-page-content";
import { WorkoutCompletePopup } from "@/components/reports/workout-complete-popup";

export default async function WorkoutPlanPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  return (
    <div className="px-1 pt-1 sm:px-0">
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <WorkoutPlanPageContent userId={userId} />
      </Suspense>
      <WorkoutCompletePopup />
    </div>
  );
}
