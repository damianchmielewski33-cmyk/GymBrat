import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { requireAdminApi } from "@/lib/admin-api";
import { assertCsrf } from "@/lib/csrf";
import { withApiErrors } from "@/lib/errors/api";
import { applyOrderAction } from "@/lib/order-admin";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum(["book", "cancel", "refund"]),
  note: z.string().trim().max(500).optional(),
});

async function handlePATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const rl = await checkRateLimitAsync(
    `admin-orders:${gate.session.user!.id}`,
    RATE.adminMutation.limit,
    RATE.adminMutation.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Zbyt wiele żądań. Spróbuj za chwilę." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowy JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

  const { id } = await ctx.params;
  await ensureCriticalSchema();
  const result = await applyOrderAction(getDb(), {
    orderId: id,
    action: parsed.data.action,
    note: parsed.data.note,
    adminEmail: gate.session.user!.email ?? "admin",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}

export const PATCH = withApiErrors(handlePATCH);
