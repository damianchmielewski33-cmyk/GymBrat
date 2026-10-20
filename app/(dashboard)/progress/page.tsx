import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProgressPageContent } from "@/components/progress/progress-page-content";
import { DashboardRouteSkeleton } from "@/components/layout/dashboard-route-skeleton";
import { parseProgressTab } from "@/lib/progress-tabs";

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
    <div className="mx-auto w-full max-w-lg space-y-3.5 pb-8">
      <header className="px-0.5">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-white">
          Analiza postępów
        </h1>
      </header>

      <Suspense fallback={<DashboardRouteSkeleton />}>
        <ProgressPageContent userId={userId} tab={tab} />
      </Suspense>
    </div>
  );
}
