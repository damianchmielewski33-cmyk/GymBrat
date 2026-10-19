import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { HofPageClient } from "@/components/community/hof/hof-page-client";
import { getHofPageData } from "@/lib/community/hof";
import {
  HOF_PERIOD_KINDS,
  type HofPeriodKind,
} from "@/lib/community/hof-types";

export default async function HallOfFamePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const sp = await searchParams;
  const kind = (
    HOF_PERIOD_KINDS.includes(sp.period as HofPeriodKind)
      ? sp.period
      : "week"
  ) as HofPeriodKind;

  const data = await getHofPageData(kind, userId);

  return <HofPageClient initial={data} kind={kind} />;
}
