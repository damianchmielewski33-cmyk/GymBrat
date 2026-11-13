import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { Palette } from "lucide-react";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { AppearancePicker } from "@/components/profile/appearance-picker";
import { ProfileSection } from "@/components/profile/profile-ui";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { parseAppTheme } from "@/lib/app-theme";

export const metadata = { title: "Wygląd" };

export default async function ProfileAppearancePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [s] = await getDb()
    .select({ appTheme: userSettings.appTheme })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Wygląd aplikacji"
        description="Motyw i kolor akcentu."
      />
      <ProfileSection icon={Palette} title="Motyw">
        <AppearancePicker initialTheme={parseAppTheme(s?.appTheme)} />
      </ProfileSection>
    </div>
  );
}
