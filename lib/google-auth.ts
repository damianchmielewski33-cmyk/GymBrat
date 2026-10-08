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

export type GoogleResolvedUser = {
  id: string;
  email: string;
  name: string | null;
  role: "zawodnik" | "trener" | "admin";
};

/** AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET (Auth.js v5). */
export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim() &&
      process.env.AUTH_GOOGLE_SECRET?.trim(),
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

function resolveAppRole(email: string, stored?: string | null): GoogleResolvedUser["role"] {
  if (parseAdminEmails().has(normalizeAdminEmail(email))) return "admin";
  if (stored === "admin" || stored === "trener") return stored;
  return "zawodnik";
}

/**
 * Tworzy albo łączy konto GymBrat z logowaniem Google (JWT bez pełnego adaptera Auth.js).
 * Istniejące konto e-mail/hasło z tym samym adresem jest powiązywane (bez duplikatu).
 */
export async function resolveGoogleSignInUser(input: {
  email: string;
  name?: string | null;
  providerAccountId: string;
}): Promise<GoogleResolvedUser | null> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.providerAccountId.trim()) return null;

  await ensureCriticalSchema();
  const db = getDb();
  const provider = "google";
  const providerAccountId = input.providerAccountId.trim();

  const [linked] = await db
    .select({
      userId: oauthAccounts.userId,
      email: users.email,
      name: users.name,
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
    const role = resolveAppRole(linked.email, linked.appRole);
    if (role === "admin" && linked.appRole !== "admin") {
      await db
        .update(users)
        .set({ appRole: "admin" })
        .where(eq(users.id, linked.userId));
    }
    return {
      id: linked.userId,
      email: linked.email,
      name: linked.name,
      role,
    };
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    await db.insert(oauthAccounts).values({
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
    if ((!existing.name || !existing.firstName) && input.name?.trim()) {
      const { firstName, lastName } = splitDisplayName(input.name);
      await db
        .update(users)
        .set({
          name: existing.name?.trim() || input.name.trim(),
          firstName: existing.firstName ?? firstName,
          lastName: existing.lastName ?? lastName,
        })
        .where(eq(users.id, existing.id));
    }
    return {
      id: existing.id,
      email: existing.email,
      name: existing.name,
      role,
    };
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hash(randomBytes(32).toString("hex"), 12);
  const { firstName, lastName } = splitDisplayName(input.name);
  const displayName = input.name?.trim() || null;
  const role = resolveAppRole(email, "zawodnik");
  const now = new Date();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    name: displayName,
    firstName,
    lastName,
    appRole: role,
    createdAt: now,
  });
  await db.insert(userSettings).values({
    userId,
    weeklyCardioGoalMinutes: 150,
  });
  await db.insert(oauthAccounts).values({
    userId,
    provider,
    providerAccountId,
  });
  await db.insert(siteActivityLog).values({
    userId,
    action: "Rejestracja konta",
    metaJson: JSON.stringify({ provider: "google", role }),
    deploymentEnv: getAnalyticsDeployment(),
  });

  return {
    id: userId,
    email,
    name: displayName,
    role,
  };
}
