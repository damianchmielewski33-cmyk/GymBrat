import { auth } from "@/auth";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { ConsentSettingsCard } from "@/components/consent/consent-settings-card";
import { SensitiveConsentsCard } from "@/components/consent/sensitive-consents-card";
import { AppPageHeader } from "@/components/layout/screen";
import { DataExportActions } from "@/components/profile/personal-data-card";
import {
  ProfileBlock,
  ProfileSection,
} from "@/components/profile/profile-ui";
import { getCurrentConsents } from "@/lib/consents";

export const metadata = { title: "Prywatność i dane" };

export default async function ProfilePrivacyPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const consents = await getCurrentConsents(userId);

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Prywatność i dane"
        description="Zgody, eksport i kontrola nad Twoimi danymi (RODO)."
      />
      <ProfileSection
        icon={ShieldCheck}
        title="Zgody"
        description="Zmiany zapisują się od razu. Zgodę możesz cofnąć w każdej chwili."
      >
        <ProfileBlock
          title="Dane o ciele, zdjęcia i przypomnienia"
          description="Osobne zgody. Bez nich nie zapiszemy raportu ciała, zdjęć ani tętna i nie wyślemy przypomnień."
        >
          <SensitiveConsentsCard
            initial={{
              health: consents.health?.granted ?? false,
              photos: consents.photos?.granted ?? false,
              push: consents.push?.granted ?? false,
            }}
          />
        </ProfileBlock>
        <ProfileBlock
          title="Cookies i analityka"
          description="Niezbędne (sesja) są zawsze włączone."
        >
          <ConsentSettingsCard
            initial={{
              analytics: consents.analytics?.granted ?? null,
              marketing: consents.marketing?.granted ?? null,
              decidedAt:
                consents.analytics?.decidedAt?.toISOString() ??
                consents.marketing?.decidedAt?.toISOString() ??
                null,
            }}
          />
        </ProfileBlock>
        <ProfileBlock
          title="Twoje dane"
          description="Eksport obejmuje dane konta, treningi, dietę i raporty dostępne w aplikacji."
        >
          <DataExportActions />
        </ProfileBlock>
      </ProfileSection>
    </div>
  );
}
