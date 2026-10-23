import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";
import { normalizeAdminEmail } from "@/lib/admin-config";
import {
  oauthAccounts,
  siteActivityLog,
  userSettings,
  users,
} from "@/db/schema";
import { decideOAuthSignIn, type OAuthDecision } from "@/lib/oauth-link-policy";
import { logSecurityEvent, securityEventInsert } from "@/lib/security-events";

export type OAuthProviderId = "google" | "facebook";

/** AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET (Auth.js v5). */
export function isGoogleAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.AUTH_GOOGLE_ID?.trim() && env.AUTH_GOOGLE_SECRET?.trim());
}

/** AUTH_FACEBOOK_ID + AUTH_FACEBOOK_SECRET (Auth.js v5). */
export function isFacebookAuthConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.AUTH_FACEBOOK_ID?.trim() && env.AUTH_FACEBOOK_SECRET?.trim());
}

/** Rozbija „Jan Kowalski” na imię / nazwisko (best-effort). */
export function splitDisplayName(name: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return { firstName: null, lastName: null };
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Imię/nazwisko z profilu Google: preferuj given_name / family_name,
 * potem rozbicie `name`.
 */
export function resolveGooglePersonName(input: {
  givenName?: string | null;
  familyName?: string | null;
  name?: string | null;
}): { firstName: string | null; lastName: string | null; displayName: string | null } {
  const given = input.givenName?.trim() || null;
  const family = input.familyName?.trim() || null;
  if (given || family) {
    const displayName = [given, family].filter(Boolean).join(" ") || null;
    return { firstName: given, lastName: family, displayName };
  }
  const split = splitDisplayName(input.name);
  const displayName = input.name?.trim() || null;
  return { ...split, displayName };
}

export type OAuthLinkedUser = {
  id: string;
  email: string;
  appRole: string;
  emailVerified: boolean;
  sessionVersion: number;
};

/** Konto powiązane z (provider, providerAccountId) — jedyne źródło `jwt` po logowaniu OAuth. */
export async function findUserByOAuthLink(
  provider: OAuthProviderId,
  providerAccountId: string,
): Promise<OAuthLinkedUser | null> {
  const [row] = await getDb()
    .select({
      id: users.id,
      email: users.email,
      appRole: users.appRole,
      emailVerifiedAt: users.emailVerifiedAt,
      sessionVersion: users.sessionVersion,
    })
    .from(oauthAccounts)
    .innerJoin(users, eq(users.id, oauthAccounts.userId))
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerAccountId, providerAccountId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    appRole: row.appRole,
    emailVerified: row.emailVerifiedAt != null,
    sessionVersion: row.sessionVersion,
  };
}

/** Powiązanie istnieje u innego konta — nigdy go nie przenosimy (BR-8). */
class OAuthLinkConflictError extends Error {
  constructor() {
    super("OAuth link belongs to another account");
    this.name = "OAuthLinkConflictError";
  }
}

/** `INSERT ... ON CONFLICT DO NOTHING`, potem kontrola właściciela powiązania. */
async function ensureOauthLink(input: {
  userId: string;
  provider: OAuthProviderId;
  providerAccountId: string;
}): Promise<void> {
  const db = getDb();
  await db
    .insert(oauthAccounts)
    .values({
      id: crypto.randomUUID(),
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      createdAt: new Date(),
    })
    .onConflictDoNothing();
  const [owner] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, input.provider),
        eq(oauthAccounts.providerAccountId, input.providerAccountId),
      ),
    )
    .limit(1);
  if (owner?.userId !== input.userId) throw new OAuthLinkConflictError();
}

type PersonName = ReturnType<typeof resolveGooglePersonName>;

/** Uzupełnia puste imię/nazwisko danymi dostawcy (nigdy nie nadpisuje wpisanych). */
async function fillMissingNames(userId: string, person: PersonName): Promise<void> {
  if (!person.firstName && !person.lastName && !person.displayName) return;
  const db = getDb();
  const [row] = await db
    .select({ name: users.name, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return;
  const nextFirst = row.firstName?.trim() || person.firstName;
  const nextLast = row.lastName?.trim() || person.lastName;
  const nextName =
    row.name?.trim() ||
    person.displayName ||
    [nextFirst, nextLast].filter(Boolean).join(" ") ||
    null;
  if (nextFirst === row.firstName && nextLast === row.lastName && nextName === row.name) return;
  await db
    .update(users)
    .set({ name: nextName, firstName: nextFirst, lastName: nextLast })
    .where(eq(users.id, userId));
}

async function createOAuthUser(input: {
  email: string;
  provider: OAuthProviderId;
  providerAccountId: string;
  emailVerified: boolean;
  person: PersonName;
}): Promise<void> {
  const db = getDb();
  const userId = crypto.randomUUID();
  const now = new Date();
  // Konto OAuth nie ma hasła znanego komukolwiek.
  const passwordHash = await hash(randomBytes(32).toString("hex"), 12);
  await db.batch([
    db.insert(users).values({
      id: userId,
      email: input.email,
      passwordHash,
      name: input.person.displayName,
      firstName: input.person.firstName,
      lastName: input.person.lastName,
      appRole: "zawodnik",
      emailVerifiedAt: input.emailVerified ? now : null,
      createdAt: now,
    }),
    db.insert(userSettings).values({ userId, weeklyCardioGoalMinutes: 150 }),
    db.insert(oauthAccounts).values({
      id: crypto.randomUUID(),
      userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      createdAt: now,
    }),
    securityEventInsert(db, { type: "oauth_register", userId, provider: input.provider }),
    db.insert(siteActivityLog).values({
      userId,
      action: "Rejestracja konta",
      metaJson: JSON.stringify({ provider: input.provider, role: "zawodnik" }),
      deploymentEnv: getAnalyticsDeployment(),
    }),
  ]);
}

export type OAuthSignInInput = {
  provider: OAuthProviderId;
  providerAccountId: string;
  email: string;
  /** Google: `email_verified === true` w profilu; dla Facebooka ignorowane. */
  providerEmailVerified: boolean;
  name?: string | null;
  givenName?: string | null;
  familyName?: string | null;
};

async function readDecision(
  input: OAuthSignInInput,
  email: string,
): Promise<{ decision: OAuthDecision; accountId: string | null }> {
  const db = getDb();
  const [linked] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, input.provider),
        eq(oauthAccounts.providerAccountId, input.providerAccountId),
      ),
    )
    .limit(1);
  const [byEmail] = email
    ? await db
        .select({ id: users.id, appRole: users.appRole, emailVerifiedAt: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
    : [];
  const decision = decideOAuthSignIn({
    provider: input.provider,
    email,
    providerEmailVerified: input.provider === "google" && input.providerEmailVerified,
    linkedUserId: linked?.userId ?? null,
    accountByEmail: byEmail
      ? {
          id: byEmail.id,
          emailVerified: byEmail.emailVerifiedAt != null,
          isAdmin: byEmail.appRole === "admin",
        }
      : null,
  });
  return { decision, accountId: byEmail?.id ?? null };
}

/**
 * Logowanie OAuth (ADR 0001 D3): odczyt danych → `decideOAuthSignIn` → wykonanie `create`
 * albo `link_existing`. Zwraca decyzję; `takeover_confirm` i `reject` obsługuje `auth.ts`.
 * Wyjątek oznacza błąd techniczny (`OAuthSignInFailed`).
 */
export async function resolveOAuthSignIn(input: OAuthSignInInput): Promise<OAuthDecision> {
  const providerAccountId = input.providerAccountId.trim();
  if (!providerAccountId) return { kind: "reject", code: "OAuthSignInFailed" };
  await ensureCriticalSchema();
  const email = normalizeAdminEmail(input.email);
  const person = resolveGooglePersonName(input);
  const normalized = { ...input, providerAccountId };

  let { decision, accountId } = await readDecision(normalized, email);
  if (decision.kind === "create") {
    try {
      await createOAuthUser({
        email,
        provider: input.provider,
        providerAccountId,
        emailVerified: decision.emailVerified,
        person,
      });
      return decision;
    } catch (err) {
      // Dwa urządzenia naraz: decyzja liczona jeszcze raz, jeden raz (US-4).
      if (!isUniqueViolation(err)) throw err;
      ({ decision, accountId } = await readDecision(normalized, email));
      if (decision.kind === "create") throw err;
    }
  }

  if (decision.kind === "login_linked") {
    await fillMissingNames(decision.userId, person);
  } else if (decision.kind === "link_existing") {
    await ensureOauthLink({ userId: decision.userId, provider: input.provider, providerAccountId });
    await fillMissingNames(decision.userId, person);
    await logSecurityEvent({ type: "oauth_link", userId: decision.userId, provider: input.provider });
    await getDb()
      .insert(siteActivityLog)
      .values({
        userId: decision.userId,
        action: "Powiązanie konta OAuth",
        metaJson: JSON.stringify({ provider: input.provider }),
        deploymentEnv: getAnalyticsDeployment(),
      })
      .catch(() => undefined);
  } else if (decision.kind === "reject" && accountId) {
    // Odmowa bez konta nie trafia do dziennika (nie zapisujemy e-maila, LR-26).
    await logSecurityEvent({
      type: "oauth_link_rejected",
      userId: accountId,
      reason: decision.code,
      provider: input.provider,
    });
  }
  return decision;
}
