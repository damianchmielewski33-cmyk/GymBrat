import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { requireAdminApi } from "@/lib/admin-api";
import { withApiErrors } from "@/lib/errors/api";
import { getPaymentAlerts, listAdminOrders } from "@/lib/order-admin";

export const runtime = "nodejs";

/** Lista zamówień (filtr `?status=`) i liczniki alertów płatności (Z22/Z23). */
async function handleGET(req: Request) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  await ensureCriticalSchema();
  const db = getDb();
  const status = new URL(req.url).searchParams.get("status")?.trim() || undefined;
  const [orders, alerts] = await Promise.all([listAdminOrders(db, { status }), getPaymentAlerts(db)]);
  return NextResponse.json({ ok: true, orders, alerts });
}

export const GET = withApiErrors(handleGET);
