"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { userSettings } from "@/db/schema";
import { remindersPrefsSchema, remindersToJson, type RemindersPrefs } from "@/lib/reminders-types";

export async function saveRemindersPrefsAction(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "Brak sesji." };

  const parsed = remindersPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Nieprawidłowe dane przypomnień." };

  const json = remindersToJson(parsed.data);
  const db = getDb();
  await db
    .update(userSettings)
    .set({
      remindersJson: json,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.user.id));

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
