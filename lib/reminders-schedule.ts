import { getCalendarTimezone } from "@/lib/local-date";
import { isValidTimeZone, type RemindersPrefs } from "@/lib/reminders-types";

export type ReminderKind = "workout" | "meal" | "checkin";

export const REMINDER_COPY: Record<
  ReminderKind,
  { title: string; body: string; url: string }
> = {
  workout: {
    title: "GymBrat — trening",
    body: "Czas na sesję. Otwórz plan lub start treningu.",
    url: "/workout-plan",
  },
  meal: {
    title: "GymBrat — posiłek",
    body: "Zaloguj makro lub dodaj posiłek na Start.",
    url: "/meal-suggestions",
  },
  checkin: {
    title: "GymBrat — check-in",
    body: "Krótki check-in dnia na stronie Start.",
    url: "/",
  },
};

const TIME_FIELD: Record<ReminderKind, "workoutTime" | "mealTime" | "checkinTime"> = {
  workout: "workoutTime",
  meal: "mealTime",
  checkin: "checkinTime",
};

/**
 * Jak długo po zaplanowanej godzinie przypomnienie nadal jest „na czas”.
 * Cron (np. co 5 min) bywa opóźniany — okno pokrywa kilka pominiętych uruchomień.
 */
export const REMINDER_DUE_WINDOW_MINUTES = 20;

/** Dzienny skrót e-mail: wysyłany w pierwszym uruchomieniu crona po tej godzinie lokalnej. */
export const EMAIL_BRIEF_HOUR = 7;

export type LocalClock = {
  dateKey: string;
  /** Minuty od północy w strefie użytkownika. */
  minutes: number;
  /** 0 = niedziela … 6 = sobota (jak Date.getDay()). */
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function resolveReminderTimeZone(prefs: RemindersPrefs): string {
  return prefs.timezone && isValidTimeZone(prefs.timezone)
    ? prefs.timezone
    : getCalendarTimezone();
}

export function localClock(now: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  return {
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + Number(get("minute")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

export function parseHm(hm: string | undefined): number | null {
  if (!hm) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export type DueReminders = {
  dateKey: string;
  kinds: ReminderKind[];
  emailDue: boolean;
};

/** Które przypomnienia powinny wyjść teraz (jeszcze bez sprawdzania, czy już wysłano). */
export function dueReminders(
  prefs: RemindersPrefs,
  now: Date,
  windowMinutes: number = REMINDER_DUE_WINDOW_MINUTES,
): DueReminders {
  const clock = localClock(now, resolveReminderTimeZone(prefs));
  const dayAllowed =
    !prefs.daysOfWeek?.length || prefs.daysOfWeek.includes(clock.weekday);

  const kinds: ReminderKind[] = [];
  if (dayAllowed) {
    for (const kind of Object.keys(TIME_FIELD) as ReminderKind[]) {
      const target = parseHm(prefs[TIME_FIELD[kind]]);
      if (target == null) continue;
      const late = clock.minutes - target;
      if (late >= 0 && late <= windowMinutes) kinds.push(kind);
    }
  }

  return {
    dateKey: clock.dateKey,
    kinds,
    emailDue: Boolean(prefs.emailDailyBrief) && clock.minutes >= EMAIL_BRIEF_HOUR * 60,
  };
}
