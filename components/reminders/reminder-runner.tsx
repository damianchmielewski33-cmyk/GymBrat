"use client";

import { useEffect, useRef } from "react";
import {
  calendarDateKey,
  calendarWeekdaySun0,
  getCalendarTimezone,
} from "@/lib/local-date";
import type { RemindersPrefs } from "@/lib/reminders-types";

function formatNowHm(): string {
  const tz = getCalendarTimezone();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

function dayAllowed(prefs: RemindersPrefs): boolean {
  if (!prefs.daysOfWeek?.length) return true;
  const key = calendarDateKey(new Date());
  const d = calendarWeekdaySun0(key);
  return prefs.daysOfWeek.includes(d);
}

function storageKey(dateKey: string, kind: string) {
  return `gymbrat:reminder:${dateKey}:${kind}`;
}

/**
 * Lokalne przypomnienia PWA (Notification API). Działa, gdy aplikacja jest otwarta
 * lub przeglądarce wolno pokazać powiadomienie — pełne tło bez push wymaga osobnej konfiguracji.
 */
export function ReminderRunner({ initialPrefs }: { initialPrefs: RemindersPrefs }) {
  const prefsRef = useRef(initialPrefs);
  prefsRef.current = initialPrefs;

  useEffect(() => {
    const id = window.setInterval(() => {
      const prefs = prefsRef.current;
      if (!prefs || typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      if (!dayAllowed(prefs)) return;

      const hm = formatNowHm();
      const dateKey = calendarDateKey(new Date());

      const tryFire = (kind: "workout" | "meal" | "checkin", time: string | undefined, title: string, body: string) => {
        if (!time || time !== hm) return;
        const sk = storageKey(dateKey, kind);
        if (sessionStorage.getItem(sk)) return;
        try {
          new Notification(title, { body, tag: `gymbrat-${kind}` });
          sessionStorage.setItem(sk, "1");
        } catch {
          /* ignore */
        }
      };

      tryFire("workout", prefs.workoutTime, "GymBrat — trening", "Czas na sesję. Otwórz plan lub start treningu.");
      tryFire("meal", prefs.mealTime, "GymBrat — posiłek", "Zaloguj makra lub dodaj posiłek na Start.");
      tryFire("checkin", prefs.checkinTime, "GymBrat — check-in", "Krótki check-in dnia na stronie Start.");
    }, 60_000);

    return () => window.clearInterval(id);
  }, []);

  return null;
}
