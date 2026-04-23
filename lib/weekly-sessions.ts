import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { workouts } from "@/db/schema";

/** Liczba unikalnych dni z treningiem w zakresie dat YYYY-MM-DD (włącznie). */
export async function countDistinctWorkoutDaysInRange(
  userId: string,
  startYmd: string,
  endYmd: string,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ c: sql<number>`count(distinct ${workouts.date})` })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        gte(workouts.date, startYmd),
        lte(workouts.date, endYmd),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}
