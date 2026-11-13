import { Suspense } from "react";
import { ProgressSkeleton } from "@/components/progress/progress-skeleton";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProgressPageContent } from "@/components/progress/progress-page-content";
import { parseProgressTab } from "@/lib/progress-tabs";

export const metadata = { title: "Analiza" };

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
        <h1 className="text-[length:var(--text-title-lg)] font-heading font-semibold leading-8 tracking-tight text-white">
          Analiza
        </h1>
      </header>

      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressPageContent tab={tab} userId={userId} />
      </Suspense>
    </div>
  );
}
