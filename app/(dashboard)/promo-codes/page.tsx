import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppMenuComingSoon } from "@/components/layout/app-menu-coming-soon";

export default async function PromoCodesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/promo-codes");

  return (
    <AppMenuComingSoon
      title="Kody rabatowe"
      description="Zniżki partnerskie (m.in. Ostrovit, Bolero, Farma Białka, Pro-Body) pojawią się tutaj."
    />
  );
}
