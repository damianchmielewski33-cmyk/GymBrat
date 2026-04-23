import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { parseRemindersJson, type RemindersPrefs } from "@/lib/reminders-types";

export async function loadRemindersPrefsForSession(): Promise<RemindersPrefs> {
  const session = await auth();
  if (!session?.user?.id) return {};

  const db = getDb();
  const [row] = await db
    .select({ remindersJson: userSettings.remindersJson })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  return parseRemindersJson(row?.remindersJson ?? null);
}
