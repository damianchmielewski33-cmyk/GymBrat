import { and, asc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { bodyReports, weightLogs } from "@/db/schema";
import { calendarDateKey } from "@/lib/local-date";
import type { HomeStartWeightPoint } from "@/lib/home-start-types";

/** Scala wagi z ważenia i raportów ciała (ten sam dzień — wygrywa późniejszy wpis). */
export function mergeWeightPointsByDay(
  entries: Array<{ date: string; kg: number; atMs: number }>,
): HomeStartWeightPoint[] {
  const byDay = new Map<string, { kg: number; atMs: number }>();
  for (const e of entries) {
    if (!e.date || !Number.isFinite(e.kg) || e.kg <= 0) continue;
    const kg = Math.round(e.kg * 10) / 10;
    const prev = byDay.get(e.date);
    if (!prev || e.atMs >= prev.atMs) {
      byDay.set(e.date, { kg, atMs: e.atMs });
    }
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, kg: v.kg }));
}

async function getMergedWeightEntries(
  userId: string,
  since?: Date,
): Promise<Array<{ date: string; kg: number; atMs: number }>> {
  const db = getDb();
  const weightWhere = since
    ? and(eq(weightLogs.userId, userId), gte(weightLogs.recordedAt, since))
    : eq(weightLogs.userId, userId);
  const reportWhere = since
    ? and(eq(bodyReports.userId, userId), gte(bodyReports.createdAt, since))
    : eq(bodyReports.userId, userId);

  const [logRows, reportRows] = await Promise.all([
    db
      .select({
        recordedAt: weightLogs.recordedAt,
        weightKg: weightLogs.weightKg,
      })
      .from(weightLogs)
      .where(weightWhere)
      .orderBy(asc(weightLogs.recordedAt)),
    db
      .select({
        createdAt: bodyReports.createdAt,
        weightKg: bodyReports.weightKg,
      })
      .from(bodyReports)
      .where(reportWhere)
      .orderBy(asc(bodyReports.createdAt)),
  ]);

  const entries: Array<{ date: string; kg: number; atMs: number }> = [];
  for (const r of logRows) {
    const d =
      r.recordedAt instanceof Date ? r.recordedAt : new Date(Number(r.recordedAt));
    if (Number.isNaN(d.getTime())) continue;
    entries.push({
      date: calendarDateKey(d),
      kg: Number(r.weightKg),
      atMs: d.getTime(),
    });
  }
  for (const r of reportRows) {
    if (r.weightKg == null) continue;
    const d =
      r.createdAt instanceof Date ? r.createdAt : new Date(Number(r.createdAt));
    if (Number.isNaN(d.getTime())) continue;
    entries.push({
      date: calendarDateKey(d),
      kg: Number(r.weightKg),
      atMs: d.getTime(),
    });
  }
  return entries;
}

export async function getWeightSeries(userId: string): Promise<HomeStartWeightPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - 370);
  const entries = await getMergedWeightEntries(userId, since);
  return mergeWeightPointsByDay(entries);
}

export async function getWeightFromStart(userId: string): Promise<{
  currentKg: number | null;
  deltaKg: number | null;
  deltaFromPreviousKg: number | null;
}> {
  const series = mergeWeightPointsByDay(await getMergedWeightEntries(userId));
  if (series.length === 0) {
    return { currentKg: null, deltaKg: null, deltaFromPreviousKg: null };
  }
  const firstKg = series[0]!.kg;
  const lastKg = series[series.length - 1]!.kg;
  const prevKg = series.length >= 2 ? series[series.length - 2]!.kg : null;

  return {
    currentKg: lastKg,
    deltaKg: Math.round((lastKg - firstKg) * 10) / 10,
    deltaFromPreviousKg:
      prevKg != null ? Math.round((lastKg - prevKg) * 10) / 10 : null,
  };
}
