import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProgressTabs } from "@/components/progress/progress-tabs";
import { ProgressPageContent } from "@/components/progress/progress-page-content";
import { DashboardRouteSkeleton } from "@/components/layout/dashboard-route-skeleton";
import { parseProgressTab } from "@/lib/progress-tabs";
import { WorkoutCompletePopup } from "@/components/reports/workout-complete-popup";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/progress");

  const sp = await searchParams;
  const tab = parseProgressTab(sp?.tab);

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-8">
      <Link
        href="/workout-plan"
        className="inline-flex items-center gap-1.5 text-sm text-white/80"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć
      </Link>

      <header className="space-y-1 px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          Analiza postępów
        </p>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-white">
          Postępy
        </h1>
      </header>

      <ProgressTabs active={tab} />

      <Suspense fallback={<DashboardRouteSkeleton />}>
        <ProgressPageContent userId={userId} tab={tab} />
      </Suspense>

      <WorkoutCompletePopup />
    </div>
  );
}
