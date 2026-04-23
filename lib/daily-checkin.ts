import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { dailyCheckins } from "@/db/schema";

export type DailyCheckinDto = {
  id: string;
  userId: string;
  date: string;
  sleepQuality: number | null;
  dayEnergy: number | null;
  stress: number | null;
  weightKg: number | null;
  notes: string | null;
  dayClosedAtMs: number | null;
  summaryJson: string | null;
};

export type UpsertDailyCheckinInput = {
  sleepQuality?: number | null;
  dayEnergy?: number | null;
  stress?: number | null;
  weightKg?: number | null;
  notes?: string | null;
};

function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v instanceof Date) return v.getTime();
  return null;
}

export async function getDailyCheckin(
  userId: string,
  dateKey: string,
): Promise<DailyCheckinDto | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(dailyCheckins)
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.date, dateKey)))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    sleepQuality: row.sleepQuality ?? null,
    dayEnergy: row.dayEnergy ?? null,
    stress: row.stress ?? null,
    weightKg: row.weightKg ?? null,
    notes: row.notes ?? null,
    dayClosedAtMs: toMs(row.dayClosedAt),
    summaryJson: row.summaryJson ?? null,
  };
}

export async function upsertDailyCheckin(
  userId: string,
  dateKey: string,
  input: UpsertDailyCheckinInput,
): Promise<DailyCheckinDto> {
  const db = getDb();

  // Best-effort upsert: first try update, otherwise insert.
  const updated = await db
    .update(dailyCheckins)
    .set({
      sleepQuality: input.sleepQuality ?? null,
      dayEnergy: input.dayEnergy ?? null,
      stress: input.stress ?? null,
      weightKg: input.weightKg ?? null,
      notes: input.notes ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.date, dateKey)))
    .returning();

  const row =
    updated[0] ??
    (
      await db
        .insert(dailyCheckins)
        .values({
          userId,
          date: dateKey,
          sleepQuality: input.sleepQuality ?? null,
          dayEnergy: input.dayEnergy ?? null,
          stress: input.stress ?? null,
          weightKg: input.weightKg ?? null,
          notes: input.notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
    )[0];

  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    sleepQuality: row.sleepQuality ?? null,
    dayEnergy: row.dayEnergy ?? null,
    stress: row.stress ?? null,
    weightKg: row.weightKg ?? null,
    notes: row.notes ?? null,
    dayClosedAtMs: toMs(row.dayClosedAt),
    summaryJson: row.summaryJson ?? null,
  };
}

export async function closeDay(
  userId: string,
  dateKey: string,
  summary: Record<string, unknown>,
): Promise<DailyCheckinDto> {
  const db = getDb();
  const json = JSON.stringify(summary);
  const updated = await db
    .update(dailyCheckins)
    .set({
      dayClosedAt: new Date(),
      summaryJson: json,
      updatedAt: new Date(),
    })
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.date, dateKey)))
    .returning();

  const row =
    updated[0] ??
    (
      await db
        .insert(dailyCheckins)
        .values({
          userId,
          date: dateKey,
          dayClosedAt: new Date(),
          summaryJson: json,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning()
    )[0];

  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    sleepQuality: row.sleepQuality ?? null,
    dayEnergy: row.dayEnergy ?? null,
    stress: row.stress ?? null,
    weightKg: row.weightKg ?? null,
    notes: row.notes ?? null,
    dayClosedAtMs: toMs(row.dayClosedAt),
    summaryJson: row.summaryJson ?? null,
  };
}

