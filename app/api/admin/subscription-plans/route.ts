import { withApiErrors } from "@/lib/errors/api";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { subscriptionPlans } from "@/db/schema";
import { requireAdminApi } from "@/lib/admin-api";
import { assertCsrf } from "@/lib/csrf";
import {
  listSubscriptionPlans,
  parsePlnToGrosze,
} from "@/lib/subscription-plans";

export const runtime = "nodejs";

async function handleGET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  const plans = await listSubscriptionPlans();
  return NextResponse.json({ ok: true, plans });
}

const patchSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(2000).optional(),
  pricePln: z.union([z.string(), z.number()]).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

async function handlePATCH(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

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
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title != null) patch.title = parsed.data.title;
  if (parsed.data.description != null) patch.description = parsed.data.description;
  if (parsed.data.active != null) patch.active = parsed.data.active ? 1 : 0;
  if (parsed.data.sortOrder != null) patch.sortOrder = parsed.data.sortOrder;
  if (parsed.data.pricePln != null) {
    const grosze = parsePlnToGrosze(parsed.data.pricePln);
    if (grosze == null) {
      return NextResponse.json({ error: "Nieprawidłowa cena." }, { status: 400 });
    }
    patch.priceGrosze = grosze;
  }

  await db
    .update(subscriptionPlans)
    .set(patch)
    .where(eq(subscriptionPlans.id, parsed.data.id));

  const plans = await listSubscriptionPlans();
  return NextResponse.json({ ok: true, plans });
}

export const GET = withApiErrors(handleGET);
export const PATCH = withApiErrors(handlePATCH);
