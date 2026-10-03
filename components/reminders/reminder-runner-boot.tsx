"use client";

import { useEffect, useState } from "react";
import { getRemindersPrefsAction } from "@/actions/reminders-prefs";
import { ReminderRunner } from "@/components/reminders/reminder-runner";
import type { RemindersPrefs } from "@/lib/reminders-types";

/**
 * Ładuje preferencje przypomnień po hydracji — nie blokuje RSC layoutu przy każdej nawigacji.
 */
export function ReminderRunnerBoot() {
  const [prefs, setPrefs] = useState<RemindersPrefs | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void getRemindersPrefsAction()
      .then((next) => {
        if (!cancelled) setPrefs(next);
      })
      .catch(() => {
        if (!cancelled) setPrefs({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (prefs === undefined) return null;
  return <ReminderRunner initialPrefs={prefs} />;
}
