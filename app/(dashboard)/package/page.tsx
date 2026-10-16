import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PackagePageClient } from "@/components/package/package-page-client";
import { listSubscriptionPlans } from "@/lib/subscription-plans";
import { getUserPackageStatus } from "@/lib/user-package";

export default async function PackagePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/package");

  const sp = await searchParams;
  const [plans, pkg] = await Promise.all([
    listSubscriptionPlans({ activeOnly: true }),
    getUserPackageStatus(session.user.id),
  ]);

  return (
    <PackagePageClient
      plans={plans.map((p) => ({
        sku: p.sku,
        title: p.title,
        description: p.description,
        days: p.days,
        priceGrosze: p.priceGrosze,
      }))}
      packageActive={pkg.active}
      daysLeft={pkg.daysLeft}
      endsLabel={pkg.endsLabel}
      planSku={pkg.planSku}
      paidHint={sp.paid === "1"}
    />
  );
}
