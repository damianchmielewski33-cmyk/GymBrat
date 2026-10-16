import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { users } from "@/db/schema";

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
