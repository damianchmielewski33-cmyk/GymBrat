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
import { isConsentGranted } from "@/lib/consents";
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

  const prefs = parseRemindersJson(s?.remindersJson ?? null);
  const hasReminders = Boolean(
    prefs.workoutTime || prefs.mealTime || prefs.checkinTime || prefs.emailDailyBrief,
  );
  // Z81: przypomnienia wysyłamy tylko za zgodą `push`; ustawione wcześniej, bez zgody, wstrzymane do ponownego zapisu.
  const needsConsent = hasReminders && !(await isConsentGranted(userId, "push"));

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
          {needsConsent ? (
            <p
              role="status"
              className="mb-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-[13px] leading-snug text-amber-100/90"
            >
              Przypomnienia są wstrzymane, dopóki nie wyrazisz zgody. Zapisz ustawienia poniżej —
              zapisanie włączonych przypomnień oznacza zgodę na ich wysyłanie (możesz ją cofnąć
              w Profilu → Konto).
            </p>
          ) : null}
          <RemindersCard
            initial={prefs}
            vapidPublicKey={
              isWebPushConfigured() ? getVapidPublicKey() : null
            }
          />
        </ProfileBlock>
      </ProfileSection>
    </div>
  );
}
