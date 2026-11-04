import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { subscriptionOrders, users } from "@/db/schema";
import { AppError } from "@/lib/errors/app-error";

export type UserPackageStatus = {
  active: boolean;
  endsAt: Date | null;
  planSku: string | null;
  daysLeft: number | null;
  endsLabel: string | null;
};

export function computePackageStatus(args: {
  packageEndsAt: Date | null | undefined;
  packagePlanSku: string | null | undefined;
  now?: Date;
}): UserPackageStatus {
  const now = args.now ?? new Date();
  const endsAt =
    args.packageEndsAt instanceof Date
      ? args.packageEndsAt
      : args.packageEndsAt
        ? new Date(args.packageEndsAt)
        : null;
  if (!endsAt || Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= now.getTime()) {
    return {
      active: false,
      endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
      planSku: args.packagePlanSku ?? null,
      daysLeft: 0,
      endsLabel: null,
    };
  }
  const ms = endsAt.getTime() - now.getTime();
  const daysLeft = Math.max(1, Math.ceil(ms / 86_400_000));
  const endsLabel = endsAt.toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return {
    active: true,
    endsAt,
    planSku: args.packagePlanSku ?? null,
    daysLeft,
    endsLabel,
  };
}

export async function getUserPackageStatus(
  userId: string,
): Promise<UserPackageStatus> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select({
      packageEndsAt: users.packageEndsAt,
      packagePlanSku: users.packagePlanSku,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return computePackageStatus({
    packageEndsAt: row?.packageEndsAt,
    packagePlanSku: row?.packagePlanSku,
  });
}

/** Przedłuża pakiet: od max(teraz, obecny koniec) + days. */
export async function extendUserPackage(args: {
  userId: string;
  days: number;
  planSku: string;
}): Promise<Date> {
  await ensureCriticalSchema();
  const db = getDb();
  const [row] = await db
    .select({ packageEndsAt: users.packageEndsAt })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);
  const now = Date.now();
  const current = row?.packageEndsAt
    ? new Date(row.packageEndsAt).getTime()
    : 0;
  const base = Math.max(now, Number.isFinite(current) ? current : 0);
  const ends = new Date(base + Math.max(1, args.days) * 86_400_000);
  await db
    .update(users)
    .set({
      packageEndsAt: ends,
      packagePlanSku: args.planSku,
    })
    .where(eq(users.id, args.userId));
  return ends;
}

/**
 * Instrukcja przedłużenia pakietu do wykonania w `db.batch` razem ze zmianą statusu zamówienia
 * (jedna transakcja). Przedłuża od max(teraz, obecny koniec) + days, a robi to tylko wtedy,
 * gdy zamówienie `orderId` nadal jest `pending` — dzięki temu powtórka ani równoległe
 * powiadomienie nie przedłużą pakietu drugi raz. Wstawiać PRZED aktualizacją zamówienia.
 */
export function extendUserPackageIfOrderPending(
  db: Database,
  args: { userId: string; orderId: string; days: number; planSku: string; now?: number },
) {
  const now = args.now ?? Date.now();
  const addMs = Math.max(1, args.days) * 86_400_000;
  return db
    .update(users)
    .set({
      packageEndsAt: sql`cast(max(${now}, coalesce(${users.packageEndsAt}, 0)) + ${addMs} as integer)`,
      packagePlanSku: args.planSku,
    })
    .where(
      and(
        eq(users.id, args.userId),
        sql`exists (select 1 from ${subscriptionOrders} where ${subscriptionOrders.id} = ${args.orderId} and ${subscriptionOrders.status} = 'pending')`,
      ),
    );
}

export async function setUserPackageEndsAt(args: {
  userId: string;
  endsAt: Date | null;
  planSku?: string | null;
}): Promise<void> {
  await ensureCriticalSchema();
  const db = getDb();
  const patch: {
    packageEndsAt: Date | null;
    packagePlanSku?: string | null;
  } = { packageEndsAt: args.endsAt };
  if (args.planSku !== undefined) {
    patch.packagePlanSku = args.planSku;
  }
  await db.update(users).set(patch).where(eq(users.id, args.userId));
}

/**
 * Czy konto ma aktywny pakiet Premium. Bez karencji (DK-12): dostęp kończy się dokładnie
 * z `packageEndsAt`; `computePackageStatus` traktuje `endsAt <= teraz` jako nieaktywny.
 */
export async function isPremiumActive(userId: string): Promise<boolean> {
  return (await getUserPackageStatus(userId)).active;
}

/**
 * Bramka funkcji Premium po stronie serwera (Z10). Wołaj w akcjach, trasach i stronach
 * Premium PRZED pobraniem danych; UI nigdy nie jest jedyną ochroną.
 * Rzuca `AppError("PREMIUM_REQUIRED")` → 402 w trasach (`withApiErrors`).
 */
export async function requirePremium(userId: string): Promise<UserPackageStatus> {
  const status = await getUserPackageStatus(userId);
  if (!status.active) throw new AppError("PREMIUM_REQUIRED");
  return status;
}
