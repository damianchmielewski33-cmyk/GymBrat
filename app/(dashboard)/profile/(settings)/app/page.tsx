import { Smartphone } from "lucide-react";
import { AndroidAppVersionCard } from "@/components/android-app-version-card";
import { IosInstallCard } from "@/components/ios-install-card";
import { AppPageHeader } from "@/components/layout/screen";
import { LocaleSwitch } from "@/components/profile/locale-switch";
import {
  ProfileBlock,
  ProfileSection,
} from "@/components/profile/profile-ui";

export default function ProfileAppPage() {
  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Aplikacja"
        description="Język interfejsu i wersja aplikacji na telefonie."
      />
      <ProfileSection
        icon={Smartphone}
        title="Ustawienia aplikacji"
        description="Dotyczy nawigacji i elementów ze słownika — pełne tłumaczenie rozszerzamy stopniowo."
      >
        <ProfileBlock title="Język interfejsu">
          <LocaleSwitch />
        </ProfileBlock>
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
