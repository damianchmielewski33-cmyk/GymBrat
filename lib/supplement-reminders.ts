import type { DietSupplement } from "@/lib/diet-supplements";
import {
  localClock,
  parseHm,
  resolveReminderTimeZone,
} from "@/lib/reminders-schedule";
import type { RemindersPrefs } from "@/lib/reminders-types";

/** Po ilu minutach od godziny przyjęcia przypominamy, jeśli suplement nie jest odhaczony. */
export const SUPPLEMENT_REMINDER_DELAY_MIN = 15;
/** Jak długo po opóźnieniu przypomnienie jest jeszcze „na czas” (cron bywa spóźniony). */
export const SUPPLEMENT_REMINDER_WINDOW_MIN = 45;

export const SUPPLEMENT_REMINDER_URL = "/";

export type DueSupplementSlot = { name: string; slot: string; dispatchKind: string };

export function supplementDispatchKind(name: string, slot: string): string {
  return `supp:${name}|${slot}`;
}

/** Sloty z godziną, które minęły (z opóźnieniem) i mieszczą się w oknie przypomnienia. */
export function dueSupplementSlots(
  supplements: DietSupplement[],
  prefs: RemindersPrefs,
  now: Date,
): { dateKey: string; slots: DueSupplementSlot[] } {
  const clock = localClock(now, resolveReminderTimeZone(prefs));
  const slots: DueSupplementSlot[] = [];
  for (const s of supplements) {
    for (const slot of s.times ?? []) {
      const target = parseHm(slot);
      if (target == null) continue;
      const late = clock.minutes - target;
      if (
        late >= SUPPLEMENT_REMINDER_DELAY_MIN &&
        late <= SUPPLEMENT_REMINDER_DELAY_MIN + SUPPLEMENT_REMINDER_WINDOW_MIN
      ) {
        slots.push({
          name: s.name,
          slot,
          dispatchKind: supplementDispatchKind(s.name, slot),
        });
      }
    }
  }
  return { dateKey: clock.dateKey, slots };
}
