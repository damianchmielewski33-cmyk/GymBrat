import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { ConsentSettingsCard } from "@/components/consent/consent-settings-card";
import { AppPageHeader } from "@/components/layout/screen";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import {
  DataExportActions,
  DeleteAccountControl,
} from "@/components/profile/personal-data-card";
import {
  ProfileBlock,
  ProfileSection,
} from "@/components/profile/profile-ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentConsents } from "@/lib/consents";

export default async function ProfileAccountPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const db = getDb();
  const [[u], consents] = await Promise.all([
    db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    getCurrentConsents(userId),
  ]);

  const hasPassword = Boolean(u?.passwordHash);

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Konto i prywatność"
        description="Hasło, zgody, eksport i usunięcie danych (RODO)."
      />
      <ProfileSection
        icon={ShieldCheck}
        title="Bezpieczeństwo i dane"
        description="Opcjonalne kategorie zgód możesz zmienić w każdej chwili."
      >
        {hasPassword ? (
          <ProfileBlock title="Zmiana hasła">
            <ChangePasswordForm />
          </ProfileBlock>
        ) : null}
        <ProfileBlock
          title="Zgody i cookies"
          description="Niezbędne (sesja) są zawsze włączone. Analityka i marketing są opcjonalne."
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
        <ProfileBlock
          tone="danger"
          title="Usuń konto"
          description="Trwale kasuje konto i powiązane dane w GymBrat. Operacji nie można cofnąć."
        >
          <DeleteAccountControl />
        </ProfileBlock>
      </ProfileSection>
    </div>
  );
}
