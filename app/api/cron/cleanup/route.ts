import { withApiErrors } from "@/lib/errors/api";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { expirePendingOrders } from "@/lib/order-admin";
import { runDbCleanup } from "@/lib/db-retention";
import { sendInactivityWarningEmail } from "@/lib/email";
import { getExtraRetentionPolicy, runBugReportRetention, runInactiveRetention } from "@/lib/retention-extra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Cleanup może trwać dłużej przy dużych batchach. */
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const hdr =
    req.headers.get("authorization") ??
    req.headers.get("x-cron-secret") ??
    "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice("Bearer ".length) : hdr;
  return token === secret;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDbCleanup();

  // Z28: retencja wg projektu prawnego (zgłoszenia błędów zawsze; nieaktywne konta/zdjęcia tylko za flagą).
  await ensureCriticalSchema();
  const db = getDb();
  const now = Date.now();
  const policy = getExtraRetentionPolicy();
  const bugReports = await runBugReportRetention(db, now, policy);
  const inactive = await runInactiveRetention(db, now, policy, {
    sendWarning: sendInactivityWarningEmail,
  });
  // Z22: wygaszenie nieopłaconych zamówień (pending > 24 h).
  const expiredOrders = await expirePendingOrders(db, now);
  return NextResponse.json({
    ok: true,
    ...result,
    extra: { bugReports, inactive, expiredOrders, inactiveAccountsEnabled: policy.inactiveAccountsEnabled },
  });
}

/** Vercel Cron woła GET (z Authorization: Bearer CRON_SECRET). */
async function handleGET(req: Request) {
  return handle(req);
}

async function handlePOST(req: Request) {
  return handle(req);
}

export const GET = withApiErrors(handleGET);
export const POST = withApiErrors(handlePOST);
