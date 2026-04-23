import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertCsrf } from "@/lib/csrf";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().min(8).max(512),
});

function safeEqToken(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * Jednorazowy bootstrap: pierwsze konto z `app_role = admin`, gdy w bazie nie ma jeszcze admina.
 * Wymaga `ADMIN_BOOTSTRAP_TOKEN` w środowisku.
 */
export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expected = process.env.ADMIN_BOOTSTRAP_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json({ error: "Bootstrap wyłączony (brak ADMIN_BOOTSTRAP_TOKEN)." }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!safeEqToken(parsed.data.token, expected)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const db = getDb();
  const existingAdmins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.appRole, "admin"))
    .limit(1);

  if (existingAdmins.length > 0) {
    return NextResponse.json(
      { error: "Administrator już istnieje w bazie — bootstrap nie jest potrzebny." },
      { status: 400 },
    );
  }

  await db
    .update(users)
    .set({ appRole: "admin" })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}
