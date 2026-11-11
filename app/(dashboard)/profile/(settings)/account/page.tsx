import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { ChangePasswordSheet } from "@/components/profile/change-password-sheet";
import { SettingsGroup } from "@/components/profile/settings-list";
import {
  DeleteAccountControl,
} from "@/components/profile/personal-data-card";
import {
  ProfileBlock,
  ProfileSection,
} from "@/components/profile/profile-ui";
import { getDb } from "@/db";
import { oauthAccounts, users } from "@/db/schema";

export const metadata = { title: "Konto i prywatność" };

export default async function ProfileAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ delete?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const db = getDb();
  const [[u], links] = await Promise.all([
    db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ provider: oauthAccounts.provider })
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId)),
  ]);

  const hasPassword = Boolean(u?.passwordHash);

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Konto i hasło"
        description="Logowanie, bezpieczeństwo i usunięcie konta."
      />
      <SettingsGroup title="Bezpieczeństwo">
        {hasPassword ? (
          <ChangePasswordSheet />
        ) : (
          <p className="px-4 py-4 text-[13px] leading-relaxed text-white/55">
            Logujesz się przez{" "}
            {links.map((l) => l.provider).join(", ") || "konto zewnętrzne"} —
            to konto nie ma hasła do zmiany.
          </p>
        )}
      </SettingsGroup>
      <ProfileSection
        icon={ShieldCheck}
        title="Strefa ryzyka"
        description="Zgody i eksport danych znajdziesz w Prywatność i dane."
      >
        <ProfileBlock
          tone="danger"
          title="Usuń konto"
          description="Trwale kasuje konto i powiązane dane w GymBrat; wymaga hasła lub świeżego logowania. Operacji nie można cofnąć."
        >
          <DeleteAccountControl
            oauthProviders={links.map((l) => l.provider)}
            autoOpen={sp.delete === "1"}
          />
        </ProfileBlock>
      </ProfileSection>
    </div>
  );
}
