import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-api";
import { getFounderUserId } from "@/lib/admin-session";
import { logAdminAction } from "@/lib/admin-audit";
import { getDb } from "@/db";
import { userSettings, users } from "@/db/schema";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    appRole: z.enum(["zawodnik", "trener"]).optional(),
    aiEntitled: z.boolean().optional(),
  })
  .refine((v) => v.appRole !== undefined || v.aiEntitled !== undefined, {
    message: "No changes",
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

  const founderId = await getFounderUserId();
  if (founderId !== null && id === founderId) {
    return NextResponse.json(
      { error: "Nie można zmienić roli pierwszego administratora w bazie." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [beforeUser] = await db
    .select({
      appRole: users.appRole,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  const [beforeSettings] = await db
    .select({ aiEntitled: userSettings.aiEntitled })
    .from(userSettings)
    .where(eq(userSettings.userId, id))
    .limit(1);

  if (parsed.data.appRole) {
    await db
      .update(users)
      .set({ appRole: parsed.data.appRole })
      .where(eq(users.id, id));
    await logAdminAction({
      actorUserId: gate.session.user!.id!,
      action: "user.app_role",
      targetUserId: id,
      meta: {
        before: beforeUser?.appRole ?? null,
        after: parsed.data.appRole,
        email: beforeUser?.email ?? null,
      },
    });
  }

  if (parsed.data.aiEntitled !== undefined) {
    const entitledInt = parsed.data.aiEntitled ? 1 : 0;
    const [existing] = await db
      .select({ userId: userSettings.userId })
      .from(userSettings)
      .where(eq(userSettings.userId, id))
      .limit(1);
    if (!existing) {
      await db.insert(userSettings).values({
        userId: id,
        weeklyCardioGoalMinutes: 150,
        aiEntitled: entitledInt,
        updatedAt: new Date(),
      });
    } else {
      await db
        .update(userSettings)
        .set({ aiEntitled: entitledInt, updatedAt: new Date() })
        .where(eq(userSettings.userId, id));
    }
    const prevEntitled =
      beforeSettings?.aiEntitled === 0 || beforeSettings?.aiEntitled === 1
        ? beforeSettings.aiEntitled === 1
        : true;
    await logAdminAction({
      actorUserId: gate.session.user!.id!,
      action: "user.ai_entitled",
      targetUserId: id,
      meta: {
        before: prevEntitled,
        after: parsed.data.aiEntitled,
        email: beforeUser?.email ?? null,
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

  const founderId = await getFounderUserId();
  if (founderId !== null && id === founderId) {
    return NextResponse.json(
      { error: "Nie można usunąć pierwszego administratora w bazie." },
      { status: 400 },
    );
  }

  const db = getDb();
  const [target] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  await db.delete(users).where(eq(users.id, id));

  await logAdminAction({
    actorUserId: sessionUserId,
    action: "user.delete",
    targetUserId: id,
    meta: { email: target?.email ?? null },
  });

  return NextResponse.json({ ok: true });
}
