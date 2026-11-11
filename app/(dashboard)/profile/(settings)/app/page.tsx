import { Smartphone } from "lucide-react";
import { AndroidAppVersionCard } from "@/components/android-app-version-card";
import { IosInstallCard } from "@/components/ios-install-card";
import { AppPageHeader } from "@/components/layout/screen";
import {
  ProfileBlock,
  ProfileSection,
} from "@/components/profile/profile-ui";

export const metadata = { title: "Aplikacja" };

export default function ProfileAppPage() {
  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Aplikacja"
        description="Instalacja i wersja aplikacji na telefonie."
      />
      <ProfileSection
        icon={Smartphone}
        title="Ustawienia aplikacji"
      >
        <ProfileBlock title="Android">
          <AndroidAppVersionCard />
        </ProfileBlock>
        <ProfileBlock title="iPhone">
          <IosInstallCard />
        </ProfileBlock>
      </ProfileSection>
    </div>
  );
}
