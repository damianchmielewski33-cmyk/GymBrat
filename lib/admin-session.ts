import { createHmac, timingSafeEqual } from "node:crypto";
import type { Session } from "next-auth";
import { cookies } from "next/headers";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getAuthSecret } from "@/lib/auth-secret";
import {
  normalizeAdminEmail,
  parseAdminEmails,
  resolveEffectiveRole,
  type AppRole,
} from "@/lib/admin-config";
import { logSecurityEvent } from "@/lib/security-events";

/** Cookie z podpisanym potwierdzeniem 2FA (Z32), ważne 12 h; zastępuje dawny PIN. */
export const ADMIN_2FA_COOKIE = "gymbrat_admin_2fa";

const SEP = "|";

/** Pierwsze konto z `app_role = admin` w bazie (rezerwa, gdy `ADMIN_EMAILS` jest puste). */
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

/** Główni admini: zweryfikowane konta z e-mailem w `ADMIN_EMAILS` (ADR 0001 D6). */
export async function getOwnerAdminUserIds(): Promise<string[]> {
  const emails = [...parseAdminEmails()];
  if (emails.length === 0) return [];
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.email, emails), isNotNull(users.emailVerifiedAt)));
  return rows.map((r) => r.id);
}

/** Konta chronione przed zmianą roli i usunięciem: główni admini albo (gdy brak) pierwszy admin. */
export async function getProtectedAdminUserIds(): Promise<string[]> {
  const owners = await getOwnerAdminUserIds();
  if (owners.length > 0) return owners;
  const founder = await getFounderUserId();
  return founder ? [founder] : [];
}

/** Tylko główny admin nadaje rolę admin innym. */
export async function isOwnerAdminActor(session: Session | null): Promise<boolean> {
  const id = session?.user?.id;
  if (!id || session.user.role !== "admin") return false;
  return (await getProtectedAdminUserIds()).includes(id);
}

/** Konto ma rolę admina (rola liczona w `jwt` z weryfikacją); drugi składnik sprawdza `isAdmin2faSatisfied`. */
export async function isAdminEligible(session: Session | null): Promise<boolean> {
  return Boolean(session?.user?.id) && session?.user?.role === "admin";
}

/**
 * Rola przy logowaniu (Credentials i OAuth): zapis `app_role = admin` z `ADMIN_EMAILS`
 * wyłącznie dla zweryfikowanego e-maila; zdarzenia nadania/odmowy tylko tutaj (LR-26, LR-28).
 */
export async function syncAdminRoleOnLogin(account: {
  id: string;
  email: string;
  appRole: string | null;
  emailVerified: boolean;
}): Promise<AppRole> {
  const role = resolveEffectiveRole(account);
  const listed = parseAdminEmails().has(normalizeAdminEmail(account.email));
  if (!listed || account.appRole === "admin") return role;
  if (role === "admin") {
    await getDb().update(users).set({ appRole: "admin" }).where(eq(users.id, account.id));
    await logSecurityEvent({ type: "admin_role_granted", userId: account.id, reason: "admin_emails" });
  } else {
    await logSecurityEvent({ type: "admin_role_denied", userId: account.id, reason: "email_unverified" });
  }
  return role;
}

export function signAdmin2faToken(userId: string): string {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SECRET");
  const expMs = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `${userId}${SEP}${expMs}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}${SEP}${sig}`;
}

export function verifyAdmin2faToken(
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

export async function readAdmin2faVerified(
  session: Session | null,
): Promise<boolean> {
  if (!session?.user?.id) return false;
  const jar = await cookies();
  const raw = jar.get(ADMIN_2FA_COOKIE)?.value;
  return verifyAdmin2faToken(raw, session.user.id);
}

/** Czy panel wymaga 2FA (env `ADMIN_2FA_REQUIRED=1`, domyślnie wyłączone — DK-22). */
export function isAdmin2faRequired(env: Record<string, string | undefined> = process.env): boolean {
  const v = env.ADMIN_2FA_REQUIRED?.trim().toLowerCase();
  return v === "1" || v === "true";
}

/** Zalogowany admin spełnia wymóg 2FA (gdy wymóg wyłączony — zawsze tak). */
export async function isAdmin2faSatisfied(session: Session | null): Promise<boolean> {
  if (!isAdmin2faRequired()) return true;
  return readAdmin2faVerified(session);
}
