import { createHmac, timingSafeEqual } from "node:crypto";
import type { Session } from "next-auth";
import { cookies } from "next/headers";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getAuthSecret } from "@/lib/auth-secret";

export const ADMIN_UNLOCK_COOKIE = "gymbrat_admin_unlock";

const SEP = "|";

/** Pierwsze konto z `app_role = admin` w bazie (chronione przed utratą roli / usunięciem z panelu). */
export async function getFounderUserId(): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.appRole, "admin"))
    .orderBy(asc(users.createdAt), asc(sql`rowid`))
    .limit(1);
  return row?.id ?? null;
}

/** Konto ma prawo wejść do ścieżki /admin (bez PIN jeszcze bez cookie). */
export async function isAdminEligible(session: Session | null): Promise<boolean> {
  if (!session?.user?.id) return false;
  return session.user.role === "admin";
}

export function signAdminUnlockToken(userId: string): string {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SECRET");
  const expMs = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `${userId}${SEP}${expMs}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}${SEP}${sig}`;
}

export function verifyAdminUnlockToken(
  token: string | undefined,
  expectedUserId: string,
): boolean {
  if (!token) return false;
  const secret = getAuthSecret();
  if (!secret) return false;
  const parts = token.split(SEP);
  if (parts.length !== 3) return false;
  const [userId, expRaw, sig] = parts;
  if (userId !== expectedUserId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const payload = `${userId}${SEP}${exp}`;
  const expectedSig = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expectedSig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function readAdminUnlockVerified(
  session: Session | null,
): Promise<boolean> {
  if (!session?.user?.id) return false;
  const jar = await cookies();
  const raw = jar.get(ADMIN_UNLOCK_COOKIE)?.value;
  return verifyAdminUnlockToken(raw, session.user.id);
}
