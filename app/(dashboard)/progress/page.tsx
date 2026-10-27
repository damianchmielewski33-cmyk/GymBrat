import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProgressPageContent } from "@/components/progress/progress-page-content";
import { DashboardRouteSkeleton } from "@/components/layout/dashboard-route-skeleton";
import { parseProgressTab } from "@/lib/progress-tabs";

function parsePeriod(raw: string | string[] | undefined): "7" | "30" | "90" {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "7" || value === "90" ? value : "30";
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[]; okres?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/progress");

  const sp = await searchParams;
  const tab = parseProgressTab(sp?.tab);
  const period = parsePeriod(sp?.okres);

  return (
    <div className="mx-auto w-full max-w-lg space-y-3.5 pb-8">
      <header className="px-0.5">
        <h1 className="font-heading text-[28px] font-semibold leading-8 tracking-tight text-white">
          Analiza postępów
        </h1>
      </header>

      <Suspense fallback={<DashboardRouteSkeleton />}>
        <ProgressPageContent tab={tab} period={period} />
      </Suspense>
    </div>
  );
}
