import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { checkRateLimitAsync, RATE } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
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

  const db = getDb();
  const userId = session.user.id;

  const [me] = await db
    .select({ appRole: users.appRole })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (me?.appRole === "admin") {
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

  await db.delete(users).where(eq(users.id, userId));

  return NextResponse.json({ ok: true });
}
