import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { Bell } from "lucide-react";
import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/layout/screen";
import { RemindersCard } from "@/components/profile/reminders-card";
import {
  ProfileBlock,
  ProfileSection,
} from "@/components/profile/profile-ui";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { parseRemindersJson } from "@/lib/reminders-types";
import { getVapidPublicKey, isWebPushConfigured } from "@/lib/web-push";

export default async function ProfileRemindersPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const db = getDb();
  const [s] = await db
    .select({ remindersJson: userSettings.remindersJson })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return (
    <div className="space-y-4">
      <AppPageHeader
        kicker="Profil"
        title="Przypomnienia"
        description="Trening, posiłki i check-in o wybranych porach."
      />
      <ProfileSection
        icon={Bell}
        title="Harmonogram"
        description="Powiadomienia działają też przy zamkniętej karcie (gdy włączysz je w przeglądarce) i w aplikacji Android."
      >
        <ProfileBlock title="Godziny i dni">
          <RemindersCard
            initial={parseRemindersJson(s?.remindersJson ?? null)}
            vapidPublicKey={
              isWebPushConfigured() ? getVapidPublicKey() : null
            }
          />
        </ProfileBlock>
      </ProfileSection>
    </div>
  );
}
