"use client";

import { useEffect, useState } from "react";
import { getWebPushPublicKeyAction } from "@/actions/push";
import { getRemindersPrefsAction } from "@/actions/reminders-prefs";
import { ReminderRunner } from "@/components/reminders/reminder-runner";
import { hasAndroidNativeReminders, syncAndroidReminders } from "@/lib/app-webview";
import { enableWebPush, isWebPushSupported } from "@/lib/push-client";
import { REMINDERS_CHANGED_EVENT, type RemindersPrefs } from "@/lib/reminders-types";

function hasReminderTimes(prefs: RemindersPrefs): boolean {
  return Boolean(prefs.workoutTime || prefs.mealTime || prefs.checkinTime);
}

/**
 * Ładuje preferencje przypomnień po hydracji — nie blokuje RSC layoutu przy każdej nawigacji.
 * Po zapisie w Profilu (zdarzenie REMINDERS_CHANGED_EVENT) pobiera je ponownie.
 *
 * Kanały dostarczania (od najlepszego):
 * 1. APK Android — natywne alarmy (AlarmManager), działają przy zamkniętej aplikacji;
 *    przy każdym starcie synchronizujemy je z zapisanymi ustawieniami.
 * 2. Web Push — wysyła serwer (cron), działa przy zamkniętej karcie.
 *    Gdy zgoda już jest, odnawiamy subskrypcję (np. po aktualizacji workera).
 * 3. Lokalny runner (Notification API) — tylko przy otwartej karcie; wyłączany, gdy
 *    działa któryś z kanałów powyżej, żeby nie dublować powiadomień.
 */
export function ReminderRunnerBoot() {
  const [prefs, setPrefs] = useState<RemindersPrefs | undefined>(undefined);
  const [backgroundDelivery, setBackgroundDelivery] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void getRemindersPrefsAction()
        .then(async (next) => {
          if (cancelled) return;
          if (hasAndroidNativeReminders()) {
            syncAndroidReminders(next);
            setBackgroundDelivery(true);
            setPrefs(next);
            return;
          }
          let pushReady = false;
          if (
            isWebPushSupported() &&
            hasReminderTimes(next) &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            const key = await getWebPushPublicKeyAction();
            if (cancelled) return;
            if (key) {
              const res = await enableWebPush(key);
              pushReady = res.ok;
            }
          }
          if (cancelled) return;
          setBackgroundDelivery(pushReady);
          setPrefs(next);
        })
        .catch(() => {
          if (!cancelled) setPrefs((prev) => prev ?? {});
        });
    };
    load();
    window.addEventListener(REMINDERS_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(REMINDERS_CHANGED_EVENT, load);
    };
  }, []);

  if (prefs === undefined) return null;
  return <ReminderRunner initialPrefs={backgroundDelivery ? {} : prefs} />;
}
