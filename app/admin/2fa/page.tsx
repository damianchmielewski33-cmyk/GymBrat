import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Admin2faClient } from "@/components/admin/admin-2fa-client";
import { ScreenCard, ScreenHeading } from "@/components/layout/screen";
import { isAdminEligible } from "@/lib/admin-session";

export const runtime = "nodejs";

/** Z32: konfiguracja i weryfikacja drugiego składnika admina (poza powłoką panelu, bo panel wymaga 2FA). */
export default async function Admin2faPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin/2fa");
  if (!(await isAdminEligible(session))) {
    return (
      <ScreenCard className="mx-auto max-w-lg">
        <ScreenHeading showBrand title="Brak dostępu" description="Ta strona jest dostępna tylko dla kont z rolą administratora." />
      </ScreenCard>
    );
  }
  return <Admin2faClient />;
}
