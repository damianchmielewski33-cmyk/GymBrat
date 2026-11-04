import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { users } from "@/db/schema";
import { assertCsrf } from "@/lib/csrf";
import { sendSupportReceivedEmail } from "@/lib/email";
import { withApiErrors } from "@/lib/errors/api";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { supportRequestSchema } from "@/lib/support";
import { createSupportRequest } from "@/lib/support-requests";

export const runtime = "nodejs";

/** Zgłoszenie do wsparcia / reklamacja (Z50). Wymaga sesji; zapis w bazie, e-mail potwierdzający best-effort. */
async function handlePOST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Zaloguj się, aby wysłać zgłoszenie." }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(`support-create:${session.user.id}`, 6, 60 * 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Zbyt wiele zgłoszeń. Spróbuj za jakiś czas." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Nieprawidłowy JSON" }, { status: 400 });
  }
  const parsed = supportRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane." },
      { status: 400 },
    );
  }

  await ensureCriticalSchema();
  const db = getDb();
  const [me] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!me) return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });

  const created = await createSupportRequest(db, {
    userId: session.user.id,
    accountEmail: me.email,
    input: parsed.data,
  });

  const to = parsed.data.contactEmail || me.email;
  const emailSent = await sendSupportReceivedEmail({
    to,
    requestId: created.id,
    subject: parsed.data.subject,
    dueAt: created.dueAt,
  }).catch(() => false);

  return NextResponse.json({ ok: true, id: created.id, dueAt: created.dueAt.toISOString(), emailSent });
}

export const POST = withApiErrors(handlePOST);
