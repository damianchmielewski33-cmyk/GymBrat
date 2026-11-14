import { auth } from "@/auth";
import { Palette } from "lucide-react";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { AppearancePicker } from "@/components/profile/appearance-picker";
import { ProfileSection } from "@/components/profile/profile-ui";
import { readAppTheme } from "@/lib/app-theme-db";

export const metadata = { title: "Wygląd" };

export default async function ProfileAppearancePage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const theme = await readAppTheme(userId);

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Wygląd aplikacji"
        description="Motyw i kolor akcentu."
      />
      <ProfileSection icon={Palette} title="Motyw">
        <AppearancePicker initialTheme={theme} />
      </ProfileSection>
    </div>
  );
}
