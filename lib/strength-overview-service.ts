/**
 * Serwis widoku zbiorczego siły: walidacja wejścia (zod), rozwiązanie zakresu,
 * wczytanie serii użytkownika (zawsze po `userId`) i policzenie wyniku.
 * Wołany z akcji serwerowej `getStrengthOverviewAction` po guardzie i sprawdzeniu sesji.
 */

import { z } from "zod";
import {
  addCalendarDays,
  calendarDateKey,
  daysBetweenDateKeys,
} from "@/lib/local-date";
import {
  MAX_OVERVIEW_RANGE_DAYS,
  buildStrengthOverview,
  resolveOverviewRange,
  type StrengthOverviewResult,
} from "@/lib/strength-overview";
import { loadStrengthOverviewSeries } from "@/lib/strength-overview-data";

const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const strengthOverviewInputSchema = z
  .object({
    preset: z.enum(["7", "30", "90", "range"]),
    from: dateKeySchema.optional(),
    to: dateKeySchema.optional(),
  })
  .strict();

export async function computeStrengthOverview(
  userId: string,
  input: unknown,
  today: string = calendarDateKey(),
): Promise<StrengthOverviewResult> {
  const parsed = strengthOverviewInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Niepoprawne parametry porównania." };
  }

  const range = resolveOverviewRange(parsed.data.preset, today, {
    from: parsed.data.from,
    to: parsed.data.to,
  });
  if (!range) {
    return {
      ok: false,
      error: `Wybierz poprawny zakres: data „od” nie późniejsza niż „do”, nie z przyszłości, maks. ${MAX_OVERVIEW_RANGE_DAYS} dni.`,
    };
  }

  // Potrzebne dane z obu okresów: [początek poprzedniego okresu, koniec].
  const days = daysBetweenDateKeys(range.from, range.to) + 1;
  const series = await loadStrengthOverviewSeries(
    userId,
    addCalendarDays(range.from, -days),
    range.to,
  );

  const overview = buildStrengthOverview(series, range.from, range.to);
  if (!overview) {
    return { ok: false, error: "Nie udało się policzyć porównania dla tego zakresu." };
  }
  return { ok: true, overview };
}
