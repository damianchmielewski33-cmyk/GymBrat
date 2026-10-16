import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-api";
import {
  getProtectedAdminUserId,
  isPrimaryAdminActor,
} from "@/lib/admin-session";
import { isPrimaryAdminEmail } from "@/lib/admin-config";
import { logAdminAction } from "@/lib/admin-audit";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { subscriptionOrders, users } from "@/db/schema";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import { getSubscriptionPlanBySku } from "@/lib/subscription-plans";
import {
  extendUserPackage,
  setUserPackageEndsAt,
} from "@/lib/user-package";

export const runtime = "nodejs";

const patchSchema = z.object({
  appRole: z.enum(["zawodnik", "trener", "admin"]).optional(),
  firstName: z.string().trim().max(80).nullable().optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  name: z.string().trim().max(120).nullable().optional(),
  adminNote: z.string().trim().max(4000).nullable().optional(),
  /** ISO date YYYY-MM-DD or null to clear package */
  packageEndsAt: z.string().nullable().optional(),
  packagePlanSku: z.string().trim().max(32).nullable().optional(),
  /** Ręczne nadanie dni pakietu (bez HotPay). */
  grantDays: z.number().int().min(1).max(3660).optional(),
  grantSku: z.string().trim().max(32).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const rl = await checkRateLimitAsync(
    rateLimitKey("admin-mutation", req),
    RATE.adminMutation.limit,
    RATE.adminMutation.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await ensureCriticalSchema();
  const db = getDb();
  const [beforeUser] = await db
    .select({
      appRole: users.appRole,
      email: users.email,
      packageEndsAt: users.packageEndsAt,
      packagePlanSku: users.packagePlanSku,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!beforeUser) {
    return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  }

  const protectedId = await getProtectedAdminUserId();
  const isProtected =
    (protectedId !== null && id === protectedId) ||
    isPrimaryAdminEmail(beforeUser.email);

  if (parsed.data.appRole != null) {
    if (isProtected) {
      return NextResponse.json(
        { error: "Nie można zmienić roli głównego administratora." },
        { status: 400 },
      );
    }
    if (
      parsed.data.appRole === "admin" &&
      !(await isPrimaryAdminActor(gate.session))
    ) {
      return NextResponse.json(
        { error: "Tylko główny administrator może nadawać uprawnienia admina." },
        { status: 403 },
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.appRole != null) patch.appRole = parsed.data.appRole;
  if (parsed.data.firstName !== undefined) patch.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) patch.lastName = parsed.data.lastName;
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.adminNote !== undefined) patch.adminNote = parsed.data.adminNote;

  if (Object.keys(patch).length > 0) {
    await db.update(users).set(patch).where(eq(users.id, id));
  }

  if (parsed.data.grantDays != null) {
    const sku = parsed.data.grantSku?.trim() || "manual";
    const plan = sku !== "manual" ? await getSubscriptionPlanBySku(sku) : null;
    const days = plan?.days ?? parsed.data.grantDays;
    const planSku = plan?.sku ?? sku;
    await extendUserPackage({ userId: id, days, planSku });
    await db.insert(subscriptionOrders).values({
      userId: id,
      planId: plan?.id ?? null,
      planSku,
      days,
      amountGrosze: 0,
      status: "manual",
      source: "admin",
      paidAt: new Date(),
    });
    await logAdminAction({
      actorUserId: gate.session.user!.id!,
      action: "user.package_grant",
      targetUserId: id,
      meta: { days, planSku },
    });
  } else if (parsed.data.packageEndsAt !== undefined) {
    let ends: Date | null = null;
    if (parsed.data.packageEndsAt) {
      const d = new Date(`${parsed.data.packageEndsAt}T23:59:59`);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "Nieprawidłowa data pakietu." },
          { status: 400 },
        );
      }
      ends = d;
    }
    await setUserPackageEndsAt({
      userId: id,
      endsAt: ends,
      planSku: parsed.data.packagePlanSku ?? beforeUser.packagePlanSku,
    });
    await logAdminAction({
      actorUserId: gate.session.user!.id!,
      action: "user.package_set",
      targetUserId: id,
      meta: {
        packageEndsAt: ends?.toISOString() ?? null,
        packagePlanSku: parsed.data.packagePlanSku ?? null,
      },
    });
  }

  if (parsed.data.appRole != null) {
    await logAdminAction({
      actorUserId: gate.session.user!.id!,
      action: "user.app_role",
      targetUserId: id,
      meta: {
        before: beforeUser.appRole ?? null,
        after: parsed.data.appRole,
        email: beforeUser.email ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const rl = await checkRateLimitAsync(
    rateLimitKey("admin-mutation", req),
    RATE.adminMutation.limit,
    RATE.adminMutation.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const sessionUserId = gate.session.user!.id!;
  const { id } = await ctx.params;

  if (id === sessionUserId) {
    return NextResponse.json(
      { error: "Nie możesz usunąć własnego konta z panelu." },
      { status: 400 },
    );
  }

  const protectedId = await getProtectedAdminUserId();
  if (protectedId !== null && id === protectedId) {
    return NextResponse.json(
      { error: "Nie można usunąć głównego administratora." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (target && isPrimaryAdminEmail(target.email)) {
    return NextResponse.json(
      { error: "Nie można usunąć głównego administratora." },
      { status: 400 },
    );
  }

  await db.delete(users).where(eq(users.id, id));

  await logAdminAction({
    actorUserId: sessionUserId,
    action: "user.delete",
    targetUserId: id,
    meta: { email: target?.email ?? null },
  });

  return NextResponse.json({ ok: true });
}
