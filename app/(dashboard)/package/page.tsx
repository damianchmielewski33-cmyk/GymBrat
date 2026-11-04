import { trackKpi, KpiEvents } from "@/lib/analytics/track-kpi";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PackagePageClient } from "@/components/package/package-page-client";
import { isPackageCheckoutEnabled } from "@/lib/feature-flags";
import { listSubscriptionPlans } from "@/lib/subscription-plans";
import { getUserPackageStatus } from "@/lib/user-package";

export const metadata = { title: "Pakiet" };

export default async function PackagePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; order?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/package");

  trackKpi(KpiEvents.packageViewed, session.user.id, {});

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
      checkoutEnabled={isPackageCheckoutEnabled()}
      renewSku={pkg.active ? pkg.planSku : null}
      paidHint={sp.paid === "1"}
      orderId={sp.paid === "1" ? (sp.order ?? null) : null}
    />
  );
}
