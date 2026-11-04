/**
 * Loader widoku zbiorczego siły: czyta sesje użytkownika z bazy i buduje serie
 * (`buildOverviewSeries` w `strength-overview-series.ts`).
 */

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";
import { buildOverviewSeries } from "@/lib/strength-overview-series";
import type { OverviewSeriesInput } from "@/lib/strength-overview";

/** Zabezpieczenie pamięci: max sesji czytanych dla widoku zbiorczego. */
const MAX_WORKOUT_ROWS = 2000;

/**
 * Wczytuje sesje użytkownika z zakresu dat [fromKey, toKey] (obie granice włącznie).
 * Zawsze filtruje po `userId` (własność danych).
 */
export async function loadStrengthOverviewSeries(
  userId: string,
  fromKey: string,
  toKey: string,
): Promise<OverviewSeriesInput[]> {
  const db = getDb();
  const rows = await db
    .select({ date: workouts.date, exercisesJson: workouts.exercises })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, fromKey),
        lte(workouts.date, toKey),
      ),
    )
    .orderBy(desc(workouts.date))
    .limit(MAX_WORKOUT_ROWS);

  return buildOverviewSeries(
    rows.map((r) => ({ date: String(r.date), exercisesJson: r.exercisesJson })),
  );
}
