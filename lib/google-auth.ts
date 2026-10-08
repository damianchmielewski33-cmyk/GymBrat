import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";
import {
  normalizeAdminEmail,
  parseAdminEmails,
} from "@/lib/admin-config";
import {
  oauthAccounts,
  siteActivityLog,
  userSettings,
  users,
} from "@/db/schema";

export type OAuthProviderId = "google" | "facebook";

export type GoogleResolvedUser = {
  id: string;
  email: string;
  name: string | null;
  role: "zawodnik" | "trener" | "admin";
  /** true = nowe konto; false = istniejące (w tym powiązanie OAuth ↔ e-mail/hasło). */
  isNew: boolean;
};

/** AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET (Auth.js v5). */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim() &&
      process.env.AUTH_GOOGLE_SECRET?.trim(),
  );
}

/** AUTH_FACEBOOK_ID + AUTH_FACEBOOK_SECRET (Auth.js v5). */
export function isFacebookAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_FACEBOOK_ID?.trim() &&
      process.env.AUTH_FACEBOOK_SECRET?.trim(),
  );
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

function resolveAppRole(email: string, stored?: string | null): GoogleResolvedUser["role"] {
  if (parseAdminEmails().has(normalizeAdminEmail(email))) return "admin";
  if (stored === "admin" || stored === "trener") return stored;
  return "zawodnik";
}

async function ensureOauthLink(input: {
  userId: string;
  provider: string;
  providerAccountId: string;
}): Promise<void> {
  const db = getDb();
  const [already] = await db
    .select({
      id: oauthAccounts.id,
      userId: oauthAccounts.userId,
    })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, input.provider),
        eq(oauthAccounts.providerAccountId, input.providerAccountId),
      ),
    )
    .limit(1);

  if (already) {
    // To samo Google już powiązane z tym kontem — OK.
    if (already.userId === input.userId) return;
    // Konflikt: Google było na innym userId — przenieś na konto z tym e-mailem.
    await db
      .update(oauthAccounts)
      .set({ userId: input.userId })
      .where(eq(oauthAccounts.id, already.id));
    return;
  }

  try {
    await db.insert(oauthAccounts).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      provider: input.provider,
      providerAccountId: input.providerAccountId,
      createdAt: new Date(),
    });
  } catch {
    // Wyścig / ponowne logowanie — sprawdź, czy link już istnieje.
    const [again] = await db
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, input.provider),
          eq(oauthAccounts.providerAccountId, input.providerAccountId),
        ),
      )
      .limit(1);
    if (again?.userId === input.userId) return;
    if (again) {
      await db
        .update(oauthAccounts)
        .set({ userId: input.userId })
        .where(
          and(
            eq(oauthAccounts.provider, input.provider),
            eq(oauthAccounts.providerAccountId, input.providerAccountId),
          ),
        );
      return;
    }
    throw new Error("Nie udało się powiązać konta Google.");
  }
}

/**
 * Tworzy albo łączy konto GymBrat z logowaniem OAuth (JWT bez pełnego adaptera Auth.js).
 * Istniejące konto e-mail/hasło z tym samym adresem jest powiązywane (bez duplikatu).
 */
export async function resolveGoogleSignInUser(input: {
  email: string;
  name?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  providerAccountId: string;
  provider?: OAuthProviderId;
}): Promise<GoogleResolvedUser | null> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.providerAccountId.trim()) return null;

  await ensureCriticalSchema();
  const db = getDb();
  const provider: OAuthProviderId = input.provider ?? "google";
  const providerAccountId = input.providerAccountId.trim();
  const person = resolveGooglePersonName({
    givenName: input.givenName,
    familyName: input.familyName,
    name: input.name,
  });

  async function fillMissingNames(userId: string, row: {
    name: string | null;
    firstName: string | null;
    lastName: string | null;
  }) {
    if (!person.firstName && !person.lastName && !person.displayName) return row.name;
    const nextFirst = row.firstName?.trim() || person.firstName;
    const nextLast = row.lastName?.trim() || person.lastName;
    const nextName =
      row.name?.trim() ||
      person.displayName ||
      [nextFirst, nextLast].filter(Boolean).join(" ") ||
      null;
    if (
      nextFirst === row.firstName &&
      nextLast === row.lastName &&
      nextName === row.name
    ) {
      return row.name;
    }
    await db
      .update(users)
      .set({
        name: nextName,
        firstName: nextFirst,
        lastName: nextLast,
      })
      .where(eq(users.id, userId));
    return nextName;
  }

  const [linked] = await db
    .select({
      userId: oauthAccounts.userId,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      appRole: users.appRole,
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

  if (linked) {
    // Google już powiązane — jeśli e-mail wskazuje inne konto hasłowe, scal do niego.
    const linkedEmail = linked.email.trim().toLowerCase();
    if (linkedEmail !== email) {
      const [byEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (byEmail && byEmail.id !== linked.userId) {
        await ensureOauthLink({
          userId: byEmail.id,
          provider,
          providerAccountId,
        });
        const role = resolveAppRole(byEmail.email, byEmail.appRole);
        if (role === "admin" && byEmail.appRole !== "admin") {
          await db
            .update(users)
            .set({ appRole: "admin" })
            .where(eq(users.id, byEmail.id));
        }
        const name = await fillMissingNames(byEmail.id, {
          name: byEmail.name,
          firstName: byEmail.firstName,
          lastName: byEmail.lastName,
        });
        return {
          id: byEmail.id,
          email: byEmail.email,
          name,
          role,
          isNew: false,
        };
      }
    }

    const role = resolveAppRole(linked.email, linked.appRole);
    if (role === "admin" && linked.appRole !== "admin") {
      await db
        .update(users)
        .set({ appRole: "admin" })
        .where(eq(users.id, linked.userId));
    }
    const name = await fillMissingNames(linked.userId, linked);
    return {
      id: linked.userId,
      email: linked.email,
      name,
      role,
      isNew: false,
    };
  }

  // To samo e-mail co konto e-mail/hasło → jedno konto (powiąż Google).
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await ensureOauthLink({
      userId: existing.id,
      provider,
      providerAccountId,
    });
    const role = resolveAppRole(existing.email, existing.appRole);
    if (role === "admin" && existing.appRole !== "admin") {
      await db
        .update(users)
        .set({ appRole: "admin" })
        .where(eq(users.id, existing.id));
    }
    const name = await fillMissingNames(existing.id, {
      name: existing.name,
      firstName: existing.firstName,
      lastName: existing.lastName,
    });
    try {
      await db.insert(siteActivityLog).values({
        userId: existing.id,
        action: "Powiązanie konta OAuth",
        metaJson: JSON.stringify({ provider, email }),
        deploymentEnv: getAnalyticsDeployment(),
      });
    } catch {
      /* nie blokuj logowania */
    }
    return {
      id: existing.id,
      email: existing.email,
      name,
      role,
      isNew: false,
    };
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hash(randomBytes(32).toString("hex"), 12);
  const role = resolveAppRole(email, "zawodnik");
  const now = new Date();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    name: person.displayName,
    firstName: person.firstName,
    lastName: person.lastName,
    appRole: role,
    createdAt: now,
  });
  await db.insert(userSettings).values({
    userId,
    weeklyCardioGoalMinutes: 150,
  });
  await ensureOauthLink({
    userId,
    provider,
    providerAccountId,
  });
  await db.insert(siteActivityLog).values({
    userId,
    action: "Rejestracja konta",
    metaJson: JSON.stringify({ provider, role }),
    deploymentEnv: getAnalyticsDeployment(),
  });

  return {
    id: userId,
    email,
    name: person.displayName,
    role,
    isNew: true,
  };
}
