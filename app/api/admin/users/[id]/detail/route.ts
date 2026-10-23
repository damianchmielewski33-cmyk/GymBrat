import { withApiErrors } from "@/lib/errors/api";
import { count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import {
  mealLogs,
  pageViews,
  subscriptionOrders,
  trainingSessions,
  users,
} from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-api";
import { getProtectedAdminUserIds } from "@/lib/admin-session";
import { computePackageStatus } from "@/lib/user-package";

export const runtime = "nodejs";

async function handleGET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  await ensureCriticalSchema();
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      appRole: users.appRole,
      weightKg: users.weightKg,
      heightCm: users.heightCm,
      age: users.age,
      activityLevel: users.activityLevel,
      packageEndsAt: users.packageEndsAt,
      packagePlanSku: users.packagePlanSku,
      adminNote: users.adminNote,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "Nie znaleziono użytkownika." }, { status: 404 });
  }

  const [meals, sessions, views, orders, protectedUserIds] = await Promise.all([
    db
      .select({ c: count() })
      .from(mealLogs)
      .where(eq(mealLogs.userId, id))
      .then((r) => Number(r[0]?.c ?? 0)),
    db
      .select({ c: count() })
      .from(trainingSessions)
      .where(eq(trainingSessions.userId, id))
      .then((r) => Number(r[0]?.c ?? 0)),
    db
      .select({ c: count() })
      .from(pageViews)
      .where(eq(pageViews.userId, id))
      .then((r) => Number(r[0]?.c ?? 0)),
    db
      .select({
        id: subscriptionOrders.id,
        planSku: subscriptionOrders.planSku,
        days: subscriptionOrders.days,
        amountGrosze: subscriptionOrders.amountGrosze,
        status: subscriptionOrders.status,
        source: subscriptionOrders.source,
        hotpayPaymentId: subscriptionOrders.hotpayPaymentId,
        createdAt: subscriptionOrders.createdAt,
        paidAt: subscriptionOrders.paidAt,
      })
      .from(subscriptionOrders)
      .where(eq(subscriptionOrders.userId, id))
      .orderBy(desc(subscriptionOrders.createdAt))
      .limit(40),
    getProtectedAdminUserIds(),
  ]);

  const pkg = computePackageStatus({
    packageEndsAt: user.packageEndsAt,
    packagePlanSku: user.packagePlanSku,
  });

  return NextResponse.json({
    ok: true,
    user,
    /** Główny administrator: bez zmiany roli i usunięcia (liczone na serwerze, ADR 0001 D6). */
    isProtected: protectedUserIds.includes(id),
    package: pkg,
    activity: {
      mealLogs: meals,
      trainingSessions: sessions,
      pageViews: views,
    },
    orders,
  });
}

export const GET = withApiErrors(handleGET);
