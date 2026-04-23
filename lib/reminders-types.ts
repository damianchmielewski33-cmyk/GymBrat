import { z } from "zod";

/** Godziny HH:mm (24h), opcjonalne dni 0–6 (niedz–sob) jak Date.getDay() */
export const remindersPrefsSchema = z.object({
  workoutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  mealTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkinTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  /** Domyślnie każdy dzień, jeśli puste */
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  /** Podsumowanie e-mail (cron) — wymaga skonfigurowanego SMTP */
  emailDailyBrief: z.boolean().optional(),
});

export type RemindersPrefs = z.infer<typeof remindersPrefsSchema>;

export function parseRemindersJson(raw: string | null | undefined): RemindersPrefs {
  if (!raw?.trim()) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    const p = remindersPrefsSchema.safeParse(j);
    return p.success ? p.data : {};
  } catch {
    return {};
  }
}

export function remindersToJson(prefs: RemindersPrefs): string | null {
  const cleaned: RemindersPrefs = {};
  if (prefs.workoutTime) cleaned.workoutTime = prefs.workoutTime;
  if (prefs.mealTime) cleaned.mealTime = prefs.mealTime;
  if (prefs.checkinTime) cleaned.checkinTime = prefs.checkinTime;
  if (prefs.daysOfWeek?.length) cleaned.daysOfWeek = prefs.daysOfWeek;
  if (prefs.emailDailyBrief) cleaned.emailDailyBrief = true;
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : null;
}
