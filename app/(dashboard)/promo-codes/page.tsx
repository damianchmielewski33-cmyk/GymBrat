import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { showUnfinishedPages } from "@/lib/feature-flags";
import { AppMenuComingSoon } from "@/components/layout/app-menu-coming-soon";

export const metadata = { title: "Kody promocyjne" };

export default async function PromoCodesPage() {
  // Z54/DK-9: bez zdefiniowanego produktu ekran jest ukryty (flaga NEXT_PUBLIC_SHOW_UNFINISHED_PAGES).
  if (!showUnfinishedPages()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/promo-codes");

  return (
    <AppMenuComingSoon
      title="Kody rabatowe"
      description="Zniżki partnerskie (m.in. Ostrovit, Bolero, Farma Białka, Pro-Body) pojawią się tutaj."
    />
  );
}
