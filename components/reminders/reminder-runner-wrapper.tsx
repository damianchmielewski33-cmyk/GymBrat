import { loadRemindersPrefsForSession } from "@/lib/load-reminders-prefs";
import { ReminderRunner } from "@/components/reminders/reminder-runner";

export async function ReminderRunnerWrapper() {
  const prefs = await loadRemindersPrefsForSession();
  return <ReminderRunner initialPrefs={prefs} />;
}
