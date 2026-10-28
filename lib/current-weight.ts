import "server-only";

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, weightLogs } from "@/db/schema";
import type { CurrentWeight } from "@/lib/current-weight-types";

export type { CurrentWeight };
export { formatCurrentWeightLabel } from "@/lib/current-weight-format";

/**
 * Aktualna waga: najnowszy `weight_logs`, fallback `users.weightKg`.
 * ADR 0006 §2 — jedno źródło prawdy bez kolumny `source`.
 */
export async function getCurrentWeightKg(
  userId: string,
): Promise<CurrentWeight | null> {
  const db = getDb();
  const [log] = await db
    .select({
      weightKg: weightLogs.weightKg,
      recordedAt: weightLogs.recordedAt,
    })
    .from(weightLogs)
    .where(eq(weightLogs.userId, userId))
    .orderBy(desc(weightLogs.recordedAt))
    .limit(1);

  if (log?.weightKg != null && Number.isFinite(log.weightKg)) {
    return {
      weightKg: Math.round(log.weightKg * 10) / 10,
      recordedAt: log.recordedAt,
    };
  }

  const [u] = await db
    .select({
      weightKg: users.weightKg,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (u?.weightKg == null || !Number.isFinite(u.weightKg)) return null;
  return {
    weightKg: Math.round(u.weightKg * 10) / 10,
    recordedAt: u.createdAt ?? new Date(),
  };
}
