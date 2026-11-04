import { withApiErrors } from "@/lib/errors/api";
import { and, eq, gt, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { reminderDispatches, users } from "@/db/schema";
import { isConsentGranted } from "@/lib/consents";
import { sendPackageExpiryEmail } from "@/lib/email";
import {
  expiryDispatchKey,
  PACKAGE_EXPIRY_DISPATCH_KIND,
  PACKAGE_EXPIRY_EMAIL_DAYS,
} from "@/lib/package-expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const hdr = req.headers.get("authorization") ?? req.headers.get("x-cron-secret") ?? "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice("Bearer ".length) : hdr;
  return token === secret;
}

/**
 * Raz dziennie: e-mail do kont, którym pakiet kończy się w ciągu PACKAGE_EXPIRY_EMAIL_DAYS dni,
 * tylko za zgodą `push` (Z11/Z81). Deduplikacja w `reminder_dispatches` kluczem = data końca pakietu.
 */
async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  await ensureCriticalSchema();
  const db = getDb();
  const now = new Date();
  const horizon = new Date(now.getTime() + PACKAGE_EXPIRY_EMAIL_DAYS * 86_400_000);

  const rows = await db
    .select({ id: users.id, email: users.email, endsAt: users.packageEndsAt })
    .from(users)
    .where(and(gt(users.packageEndsAt, now), lte(users.packageEndsAt, horizon)));

  let sent = 0;
  for (const r of rows) {
    if (!r.email || !r.endsAt) continue;
    if (!(await isConsentGranted(r.id, "push"))) continue;
    const dateKey = expiryDispatchKey(r.endsAt);
    const claimed = await db
      .insert(reminderDispatches)
      .values({ userId: r.id, dateKey, kind: PACKAGE_EXPIRY_DISPATCH_KIND })
      .onConflictDoNothing()
      .returning({ kind: reminderDispatches.kind });
    if (claimed.length === 0) continue;

    const daysLeft = Math.max(1, Math.ceil((r.endsAt.getTime() - now.getTime()) / 86_400_000));
    const ok = await sendPackageExpiryEmail({ to: r.email, daysLeft });
    if (ok) {
      sent += 1;
    } else {
      // Brak SMTP / błąd wysyłki: zwolnij wpis, żeby kolejne uruchomienie spróbowało ponownie.
      await db
        .delete(reminderDispatches)
        .where(
          and(
            eq(reminderDispatches.userId, r.id),
            eq(reminderDispatches.dateKey, dateKey),
            eq(reminderDispatches.kind, PACKAGE_EXPIRY_DISPATCH_KIND),
          ),
        );
    }
  }
  return NextResponse.json({ ok: true, candidates: rows.length, sent });
}

export const GET = withApiErrors(handle);
export const POST = withApiErrors(handle);
