"use server";

import { loadRemindersPrefsForSession } from "@/lib/load-reminders-prefs";
import type { RemindersPrefs } from "@/lib/reminders-types";

export async function getRemindersPrefsAction(): Promise<RemindersPrefs> {
  return loadRemindersPrefsForSession();
}
