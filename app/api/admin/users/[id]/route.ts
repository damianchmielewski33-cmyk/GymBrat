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
import { users } from "@/db/schema";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

const patchSchema = z.object({
  appRole: z.enum(["zawodnik", "trener", "admin"]),
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

  const protectedId = await getProtectedAdminUserId();
  if (protectedId !== null && id === protectedId) {
    return NextResponse.json(
      { error: "Nie można zmienić roli głównego administratora." },
      { status: 400 },
    );
  }

  if (parsed.data.appRole === "admin" && !(await isPrimaryAdminActor(gate.session))) {
    return NextResponse.json(
      { error: "Tylko główny administrator może nadawać uprawnienia admina." },
      { status: 403 },
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

  if (beforeUser && isPrimaryAdminEmail(beforeUser.email)) {
    return NextResponse.json(
      { error: "Nie można zmienić roli głównego administratora." },
      { status: 400 },
    );
  }

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
