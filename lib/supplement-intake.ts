import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { supplementIntakes, userSettings } from "@/db/schema";
import {
  resolveDietSupplementItems,
  supplementSlots,
} from "@/lib/diet-supplements";
import { calendarDateKey } from "@/lib/local-date";

export type IntakeItem = { name: string; slot: string };

/**
 * Odhacza / cofa przyjęcia na dziś. Pomija pozycje, których nie ma na liście użytkownika.
 * Zwraca liczbę zmienionych pozycji.
 */
export async function setIntakes(
  userId: string,
  items: IntakeItem[],
  taken: boolean,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({
      fitnessGoalsJson: userSettings.fitnessGoalsJson,
      mealTemplatesJson: userSettings.mealTemplatesJson,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  const list = resolveDietSupplementItems(
    row?.fitnessGoalsJson,
    row?.mealTemplatesJson,
  );
  const valid = items.filter((it) => {
    const s = list.find((x) => x.name === it.name);
    return s ? supplementSlots(s).includes(it.slot) : false;
  });
  if (valid.length === 0) return 0;

  await ensureCriticalSchema();
  const dateKey = calendarDateKey();
  for (const it of valid) {
    if (taken) {
      await db
        .insert(supplementIntakes)
        .values({ userId, dateKey, name: it.name, slot: it.slot })
        .onConflictDoNothing();
    } else {
      await db
        .delete(supplementIntakes)
        .where(
          and(
            eq(supplementIntakes.userId, userId),
            eq(supplementIntakes.dateKey, dateKey),
            eq(supplementIntakes.name, it.name),
            eq(supplementIntakes.slot, it.slot),
          ),
        );
    }
  }
  return valid.length;
}
