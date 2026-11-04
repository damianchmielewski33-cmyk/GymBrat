import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { requireAdminApi } from "@/lib/admin-api";
import { withApiErrors } from "@/lib/errors/api";
import { getFinanceSummary } from "@/lib/finance-data";
import { getPaymentAlerts } from "@/lib/order-admin";

export const runtime = "nodejs";

/** Panel finansowy (Z75): przychody dzienne/miesięczne, aktywne pakiety, konwersja, alerty. */
async function handleGET() {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;
  await ensureCriticalSchema();
  const db = getDb();
  const [summary, alerts] = await Promise.all([getFinanceSummary(db), getPaymentAlerts(db)]);
  return NextResponse.json({ ok: true, ...summary, alerts });
}

export const GET = withApiErrors(handleGET);
