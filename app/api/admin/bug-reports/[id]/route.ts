import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { bugReports } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-api";
import { BUG_STATUSES } from "@/lib/bug-reports";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(BUG_STATUSES),
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
    `admin-bug-patch:${gate.session.user!.id}`,
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
  if (!id?.trim()) {
    return NextResponse.json({ error: "Brak identyfikatora." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowy status." }, { status: 400 });
  }

  await ensureCriticalSchema();
  const db = getDb();
  const now = new Date();
  const [updated] = await db
    .update(bugReports)
    .set({
      status: parsed.data.status,
      resolvedAt: parsed.data.status === "fixed" ? now : null,
    })
    .where(eq(bugReports.id, id))
    .returning({ id: bugReports.id, status: bugReports.status });

  if (!updated) {
    return NextResponse.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, bug: updated });
}
