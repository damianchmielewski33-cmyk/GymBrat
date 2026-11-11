import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProfileBackBar } from "@/components/profile/profile-ui";

/**
 * Layout ustawień profilu: bez zakładek — przegląd `/profile` to lista grup,
 * a każda podstrona ma przycisk „Profil” (wstecz).
 */
export default async function ProfileSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="space-y-3">
      <ProfileBackBar />
      {children}
    </div>
  );
}
