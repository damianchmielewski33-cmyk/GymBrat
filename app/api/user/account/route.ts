import { withApiErrors } from "@/lib/errors/api";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { deleteUserAccount, verifyDeleteReauth } from "@/lib/account-delete";
import { sendAccountDeletedEmail } from "@/lib/email";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

const DELETE_CONFIRM_PHRASE = "USUŃ";

const bodySchema = z.object({
  confirm: z.string().max(20),
  password: z.string().min(1).max(200).optional(),
});

/**
 * Usunięcie konta (RODO art. 17, Z14). Wymaga: CSRF, sesji, frazy potwierdzającej oraz ponownego
 * uwierzytelnienia — hasła albo świeżego logowania (≤ 5 min, np. OAuth). Kod `REAUTH_REQUIRED`
 * mówi UI, że trzeba zalogować się ponownie.
 */
async function handleDELETE(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
  }

  const rl = await checkRateLimitAsync(
    `account-delete:${session.user.id}`,
    RATE.accountDelete.limit,
    RATE.accountDelete.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    /* brak ciała = brak frazy → 400 poniżej */
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success || parsed.data.confirm.trim().toUpperCase() !== DELETE_CONFIRM_PHRASE) {
    return NextResponse.json(
      { ok: false, error: `Wpisz ${DELETE_CONFIRM_PHRASE}, aby potwierdzić usunięcie konta.` },
      { status: 400 },
    );
  }

  const db = getDb();
  const userId = session.user.id;

  const [me] = await db
    .select({ appRole: users.appRole, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!me) return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });

  const reauth = await verifyDeleteReauth({
    password: parsed.data.password,
    passwordHash: me.passwordHash,
    authAt: session.authAt,
  });
  if (!reauth.ok) {
    return NextResponse.json(
      reauth.reason === "password_invalid"
        ? { ok: false, code: "PASSWORD_INVALID", error: "Nieprawidłowe hasło." }
        : {
            ok: false,
            code: "REAUTH_REQUIRED",
            error: "Potwierdź tożsamość: podaj hasło lub zaloguj się ponownie.",
          },
      { status: 403 },
    );
  }

  if (me.appRole === "admin") {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.appRole, "admin"));
    if (admins.length <= 1) {
      return NextResponse.json(
        {
          error:
            "Jesteś jedynym kontem z rolą administratora w bazie — przed usunięciem nadaj rolę innemu użytkownikowi lub dodaj kolejnego admina.",
        },
        { status: 400 },
      );
    }
  }

  await deleteUserAccount(db, userId);

  // Potwierdzenie e-mailem: best-effort (brak SMTP nie cofa usunięcia), adres tylko z pamięci żądania.
  const emailSent = await sendAccountDeletedEmail({ to: me.email }).catch(() => false);

  return NextResponse.json({ ok: true, emailSent });
}

export const DELETE = withApiErrors(handleDELETE);
