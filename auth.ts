import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";
import { authCookiesForEmbed } from "@/lib/auth-cookies";
import {
  loginAwpWithEmail,
  loginAwpWithPin,
  upsertGymBratUserFromAwp,
} from "@/lib/awp-account";
import { siteActivityLog, users } from "@/db/schema";
import { getAuthSecret } from "@/lib/auth-secret";
import { ensureCriticalSchema } from "@/db/ensure-schema";

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS;
  const out = new Set<string>();
  if (!raw) return out;
  for (const s of raw.split(",")) {
    const t = s.trim().toLowerCase();
    if (t) out.add(t);
  }
  return out;
}

async function authorizeLocalEmailPassword(
  email: string,
  password: string,
  role: "zawodnik" | "trener",
): Promise<{
  id: string;
  email: string;
  name: string | undefined;
  role: "zawodnik" | "trener" | "admin";
} | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  if (!user) return null;

  const { compare } = await import("bcryptjs");
  const valid = await compare(password, user.passwordHash);
  if (!valid) return null;

  const adminEmails = parseAdminEmails();
  const emailLower = user.email.toLowerCase();
  const isEnvAdmin = adminEmails.has(emailLower);

  if (user.appRole === "admin" || isEnvAdmin) {
    if (isEnvAdmin && user.appRole !== "admin") {
      await db
        .update(users)
        .set({ appRole: "admin" })
        .where(eq(users.id, user.id));
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
      role: "admin",
    };
  }

  const storedRaw = user.appRole ?? "zawodnik";
  const storedRole: "zawodnik" | "trener" =
    storedRaw === "trener" ? "trener" : "zawodnik";
  if (storedRole !== role) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? undefined,
    role: storedRole,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: getAuthSecret(),
  /** CHIPS / SameSite=None — sesja działa w iframe AWP (third-party cookie partition). */
  cookies: authCookiesForEmbed(),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        firstName: { label: "Imię", type: "text" },
        lastName: { label: "Nazwisko", type: "text" },
        pin: { label: "PIN", type: "password" },
        role: { label: "Role", type: "text" },
        /** `pin` (domyślnie, jak AWP) albo `email`. */
        mode: { label: "Mode", type: "text" },
      },
      async authorize(credentials) {
        const rawRole = credentials?.role as string | undefined;
        const role: "zawodnik" | "trener" =
          rawRole === "trener" ? "trener" : "zawodnik";
        const modeRaw = String(credentials?.mode ?? "").trim().toLowerCase();
        const firstName = String(credentials?.firstName ?? "").trim();
        const lastName = String(credentials?.lastName ?? "").trim();
        const pin = String(credentials?.pin ?? "").trim();
        const email = String(credentials?.email ?? "").trim();
        const password = String(credentials?.password ?? "");

        const preferPin =
          modeRaw === "pin" ||
          (!modeRaw && Boolean(firstName && lastName && pin));

        await ensureCriticalSchema();

        if (preferPin && firstName && lastName && pin) {
          const awp = await loginAwpWithPin({ firstName, lastName, pin });
          if (!awp.ok) return null;
          const linked = await upsertGymBratUserFromAwp(awp.profile);
          return {
            id: linked.id,
            email: linked.email,
            name: linked.name,
            role: linked.role,
          };
        }

        if (!email || !password) return null;

        const local = await authorizeLocalEmailPassword(email, password, role);
        if (local) return local;

        // Wspólne konto: spróbuj e-mail/hasło Akademii, potem zlinkuj lokalnie.
        const awp = await loginAwpWithEmail({ email, password });
        if (!awp.ok) return null;
        const linked = await upsertGymBratUserFromAwp(awp.profile);
        if (linked.role === "admin") {
          return {
            id: linked.id,
            email: linked.email,
            name: linked.name,
            role: "admin",
          };
        }
        if (role !== "zawodnik") return null;
        return {
          id: linked.id,
          email: linked.email,
          name: linked.name,
          role: "zawodnik",
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    jwt({ token, user }) {
      const uid =
        typeof user?.id === "string"
          ? user.id
          : typeof token.id === "string"
            ? token.id
            : typeof token.sub === "string"
              ? token.sub
              : undefined;
      if (uid) {
        token.id = uid;
        token.sub = uid;
      }
      if (user && "role" in user && user.role) {
        token.role = user.role as "zawodnik" | "trener" | "admin";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        const id =
          (typeof token.id === "string" ? token.id : undefined) ??
          (typeof token.sub === "string" ? token.sub : undefined);
        if (id) session.user.id = id;
        session.user.role =
          (token.role as "zawodnik" | "trener" | "admin" | undefined) ??
          "zawodnik";
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      try {
        const id = user?.id;
        if (!id || typeof id !== "string") return;
        const db = getDb();
        await db.insert(siteActivityLog).values({
          userId: id,
          action: "Logowanie",
          deploymentEnv: getAnalyticsDeployment(),
        });
      } catch {
        /* nie blokuj logowania przy błędzie zapisu */
      }
    },
  },
});
