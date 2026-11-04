"use server";

import { guardAction } from "@/lib/action-guard";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userConsents, userSettings } from "@/db/schema";
import { CURRENT_CONSENT_TEXT_VERSION } from "@/lib/consents-client";
import { isConsentGranted } from "@/lib/consents";
import { remindersPrefsSchema, remindersToJson, type RemindersPrefs } from "@/lib/reminders-types";

export async function saveRemindersPrefsAction(input: unknown) {
  await guardAction("reminders.saveRemindersPrefsAction");
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };

  const parsed = remindersPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Nieprawidłowe dane przypomnień." };

  const json = remindersToJson(parsed.data);
  const db = getDb();
  const [existing] = await db
    .select({ userId: userSettings.userId })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  if (existing) {
    await db
      .update(userSettings)
      .set({ remindersJson: json, updatedAt: new Date() })
      .where(eq(userSettings.userId, session.user.id));
  } else {
    await db.insert(userSettings).values({
      userId: session.user.id,
      weeklyCardioGoalMinutes: 150,
      remindersJson: json,
      updatedAt: new Date(),
    });
  }

  // Z81: włączenie przypomnień to wyraźna zgoda `push`, wyłączenie wszystkich ją cofa (rejestr append-only).
  const wantsReminders = Boolean(
    parsed.data.workoutTime ||
      parsed.data.mealTime ||
      parsed.data.checkinTime ||
      parsed.data.emailDailyBrief,
  );
  const currently = await isConsentGranted(session.user.id, "push");
  if (wantsReminders !== currently) {
    await db.insert(userConsents).values({
      userId: session.user.id,
      type: "push",
      granted: wantsReminders,
      textVersion: CURRENT_CONSENT_TEXT_VERSION,
      source: "reminders",
    });
  }

  revalidatePath("/profile");
  return { ok: true as const };
}

export async function getRemindersPrefsForUser(): Promise<RemindersPrefs> {
  const session = await auth();
  if (!session?.user?.id) return {};

  const db = getDb();
  const [row] = await db
    .select({ remindersJson: userSettings.remindersJson })
    .from(userSettings)
    .where(eq(userSettings.userId, session.user.id))
    .limit(1);

  if (!row?.remindersJson) return {};
  try {
    const j = JSON.parse(row.remindersJson) as unknown;
    const p = remindersPrefsSchema.safeParse(j);
    return p.success ? p.data : {};
  } catch {
    return {};
  }
}
