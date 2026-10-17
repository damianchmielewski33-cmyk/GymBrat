/**
 * Budżet storage Turso / libSQL — pomiar PRAGMA + soft/hard limity.
 * Soft: blokada nowych blobów. Hard: emergency purge w cron cleanup.
 * Fizyczny odzysk miejsca zależy od kompakcji po stronie Turso — retencja
 * przede wszystkim zatrzymuje przyrost.
 */

import type { Client } from "@libsql/client";
import { getDb } from "@/db";
import {
  cacheGet,
  cacheInvalidate,
  cacheSet,
} from "@/lib/community/perf-cache";

export const DB_BLOB_FULL_MESSAGE =
  "Brak miejsca w bazie — spróbuj bez zdjęcia lub później.";

const USAGE_CACHE_KEY = "db:storage:usage";
const USAGE_CACHE_TTL_MS = 60_000;

type DbWithClient = ReturnType<typeof getDb> & { $client: Client };

function envMb(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

export type DbStorageUsage = {
  usedBytes: number;
  usedMb: number;
  softMb: number;
  hardMb: number;
  pageCount: number;
  pageSize: number;
  overSoft: boolean;
  overHard: boolean;
};

export function getStorageLimits(): { softMb: number; hardMb: number } {
  const softMb = envMb("TURSO_STORAGE_SOFT_LIMIT_MB", 700);
  const hardMb = Math.max(softMb, envMb("TURSO_STORAGE_HARD_LIMIT_MB", 850));
  return { softMb, hardMb };
}

function getClient(): Client {
  const db = getDb() as DbWithClient;
  if (!db.$client) {
    throw new Error("Brak klienta libSQL do pomiaru storage.");
  }
  return db.$client;
}

async function pragmaNumber(client: Client, sql: string): Promise<number> {
  const rs = await client.execute(sql);
  const row = rs.rows[0];
  if (!row) return 0;
  const v = Object.values(row as Record<string, unknown>)[0];
  const n = typeof v === "bigint" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Świeży pomiar (bez cache). */
export async function measureDbStorageUsage(): Promise<DbStorageUsage> {
  const client = getClient();
  const [pageCount, pageSize] = await Promise.all([
    pragmaNumber(client, "PRAGMA page_count"),
    pragmaNumber(client, "PRAGMA page_size"),
  ]);
  const usedBytes = Math.max(0, pageCount) * Math.max(0, pageSize);
  const usedMb = usedBytes / (1024 * 1024);
  const { softMb, hardMb } = getStorageLimits();
  return {
    usedBytes,
    usedMb: Math.round(usedMb * 100) / 100,
    softMb,
    hardMb,
    pageCount,
    pageSize,
    overSoft: usedMb >= softMb,
    overHard: usedMb >= hardMb,
  };
}

export async function getDbStorageUsage(
  opts?: { force?: boolean },
): Promise<DbStorageUsage> {
  if (!opts?.force) {
    const cached = cacheGet<DbStorageUsage>(USAGE_CACHE_KEY);
    if (cached) return cached;
  }
  const usage = await measureDbStorageUsage();
  cacheSet(USAGE_CACHE_KEY, usage, USAGE_CACHE_TTL_MS);
  return usage;
}

export function invalidateDbStorageUsageCache(): void {
  cacheInvalidate(USAGE_CACHE_KEY);
}

/**
 * Guard przed zapisem blobów (data URL / base64).
 * `approxBytes` — szacunek rozmiaru; jeśli pominięte, sprawdzamy tylko soft limit.
 */
export async function assertCanStoreBlob(
  approxBytes = 0,
): Promise<
  | { ok: true; usage: DbStorageUsage }
  | { ok: false; error: string; usage: DbStorageUsage }
> {
  const usage = await getDbStorageUsage();
  if (usage.overSoft) {
    return { ok: false, error: DB_BLOB_FULL_MESSAGE, usage };
  }
  const projectedMb = (usage.usedBytes + Math.max(0, approxBytes)) / (1024 * 1024);
  if (projectedMb >= usage.softMb) {
    return { ok: false, error: DB_BLOB_FULL_MESSAGE, usage };
  }
  return { ok: true, usage };
}
