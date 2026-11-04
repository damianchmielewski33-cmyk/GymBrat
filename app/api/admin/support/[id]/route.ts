import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { supportRequests } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-api";
import { assertCsrf } from "@/lib/csrf";
import { withApiErrors } from "@/lib/errors/api";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";
import { SUPPORT_STATUSES } from "@/lib/support";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    status: z.enum(SUPPORT_STATUSES).optional(),
    adminNote: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNote !== undefined, { message: "Brak zmian." });

async function handlePATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const rl = await checkRateLimitAsync(
    `admin-support-patch:${gate.session.user!.id}`,
    RATE.adminMutation.limit,
    RATE.adminMutation.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Zbyt wiele żądań. Spróbuj za chwilę." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  await ensureCriticalSchema();
  const db = getDb();
  const patch: Partial<typeof supportRequests.$inferInsert> = {};
  if (parsed.data.status) {
    patch.status = parsed.data.status;
    patch.resolvedAt = parsed.data.status === "resolved" ? new Date() : null;
  }
  if (parsed.data.adminNote !== undefined) patch.adminNote = parsed.data.adminNote || null;

  const updated = await db
    .update(supportRequests)
    .set(patch)
    .where(eq(supportRequests.id, id))
    .returning({ id: supportRequests.id });
  if (updated.length === 0) {
    return NextResponse.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export const PATCH = withApiErrors(handlePATCH);
