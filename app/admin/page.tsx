import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdminEligible } from "@/lib/admin-session";
import { ScreenCard, ScreenHeading } from "@/components/layout/screen";

export default async function AdminGatePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  const eligible = await isAdminEligible(session);
  if (eligible) {
    redirect("/admin/overview");
  }

  return (
    <ScreenCard className="mx-auto max-w-lg">
      <ScreenHeading
        showBrand
        title="Brak dostępu"
        description="Panel administratora jest dostępny tylko dla kont z rolą administratora."
      />
    </ScreenCard>
  );
}
