import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { MealSuggestionsPageContent } from "@/components/meal-suggestions/meal-suggestions-page-content";
import { DashboardRouteSkeleton } from "@/components/layout/dashboard-route-skeleton";
import { parseDietTab } from "@/lib/diet-tabs";

export default async function MealSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/meal-suggestions");

  const sp = await searchParams;
  const initialTab = parseDietTab(sp?.tab);

  return (
    <Suspense fallback={<DashboardRouteSkeleton />}>
      <MealSuggestionsPageContent
        userId={userId}
        session={session}
        initialTab={initialTab}
      />
    </Suspense>
  );
}
