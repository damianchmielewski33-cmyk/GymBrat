import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";
import { siteActivityLog, users } from "@/db/schema";
import { getAuthSecret } from "@/lib/auth-secret";
import {
  normalizeAdminEmail,
  parseAdminEmails,
} from "@/lib/admin-config";
import {
  isFacebookAuthConfigured,
  isGoogleAuthConfigured,
  resolveGoogleSignInUser,
  type OAuthProviderId,
} from "@/lib/google-auth";
import { isUserBodyProfileComplete } from "@/lib/profile-complete";

function isOAuthProvider(id: string | undefined): id is OAuthProviderId {
  return id === "google" || id === "facebook";
}

function oauthProfileFields(
  profile: unknown,
  user?: { email?: string | null; name?: string | null },
) {
  const p = profile as {
    email?: unknown;
    name?: unknown;
    given_name?: unknown;
    family_name?: unknown;
    first_name?: unknown;
    last_name?: unknown;
    email_verified?: unknown;
  } | null;
  const email =
    (typeof p?.email === "string" && p.email) ||
    (typeof user?.email === "string" && user.email) ||
    "";
  const name =
    (typeof p?.name === "string" && p.name) ||
    (typeof user?.name === "string" && user.name) ||
    null;
  const givenName =
    typeof p?.given_name === "string"
      ? p.given_name
      : typeof p?.first_name === "string"
        ? p.first_name
        : null;
  const familyName =
    typeof p?.family_name === "string"
      ? p.family_name
      : typeof p?.last_name === "string"
        ? p.last_name
        : null;
  const emailVerified = p?.email_verified;
  return { email, name, givenName, familyName, emailVerified };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: getAuthSecret(),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const rawRole = credentials?.role as string | undefined;
        const role: "zawodnik" | "trener" =
          rawRole === "trener" ? "trener" : "zawodnik";
        if (!email || !password) return null;

        const db = getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);
        if (!user?.passwordHash) return null;

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
        const storedRole = storedRaw === "trener" ? "trener" : "zawodnik";

        if (storedRole !== role) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: storedRole,
        };
      },
    }),
    ...(isGoogleAuthConfigured()
      ? [
          Google({
            allowDangerousEmailAccountLinking: true,
            authorization: {
              params: {
                scope: "openid email profile",
              },
            },
          }),
        ]
      : []),
    ...(isFacebookAuthConfigured()
      ? [
          Facebook({
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      if (!isOAuthProvider(account?.provider)) return true;
      const { email, name, givenName, familyName, emailVerified } =
        oauthProfileFields(profile);
      if (!email.trim()) return false;
      // Google / Facebook — bez zweryfikowanego e-maila nie łączymy kont.
      if (emailVerified === false) return false;

      const providerAccountId =
        typeof account.providerAccountId === "string"
          ? account.providerAccountId
          : "";
      if (!providerAccountId) return false;

      const resolved = await resolveGoogleSignInUser({
        email,
        name,
        givenName,
        familyName,
        providerAccountId,
        provider: account.provider,
      });
      return Boolean(resolved);
    },
    async jwt({ token, user, account, profile, trigger }) {
      if (isOAuthProvider(account?.provider)) {
        const { email, name, givenName, familyName } = oauthProfileFields(
          profile,
          user,
        );
        const providerAccountId =
          typeof account.providerAccountId === "string"
            ? account.providerAccountId
            : "";

        const resolved = await resolveGoogleSignInUser({
          email,
          name,
          givenName,
          familyName,
          providerAccountId,
          provider: account.provider,
        });
        if (!resolved) {
          throw new Error("Nie udało się utworzyć lub połączyć konta OAuth.");
        }
        token.id = resolved.id;
        token.sub = resolved.id;
        token.email = resolved.email;
        token.role = resolved.role;
        if (resolved.name) token.name = resolved.name;
        // Nowe konto OAuth — wymuś /complete-profile; powiązane hasłowe zachowuje status z DB.
        token.profileComplete = resolved.isNew ? false : undefined;
      } else {
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
        if (user && typeof user.email === "string" && user.email) {
          token.email = user.email;
        }
      }

      let email =
        typeof token.email === "string" ? normalizeAdminEmail(token.email) : "";
      const userId =
        typeof token.id === "string"
          ? token.id
          : typeof token.sub === "string"
            ? token.sub
            : "";

      if (userId && !email) {
        try {
          const db = getDb();
          const [row] = await db
            .select({ email: users.email, appRole: users.appRole })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
          if (row?.email) {
            email = normalizeAdminEmail(row.email);
            token.email = row.email;
            if (row.appRole === "admin") {
              token.role = "admin";
            }
          }
        } catch {
          /* nie blokuj sesji */
        }
      }

      const adminEmails = parseAdminEmails();
      if (email && adminEmails.has(email)) {
        const wasAdmin = token.role === "admin";
        token.role = "admin";
        if (!wasAdmin && userId) {
          try {
            const db = getDb();
            await db
              .update(users)
              .set({ appRole: "admin" })
              .where(eq(users.id, userId));
          } catch {
            /* ignore */
          }
        }
      }

      if (
        userId &&
        (trigger === "update" ||
          trigger === "signIn" ||
          token.profileComplete !== true)
      ) {
        try {
          const db = getDb();
          const [row] = await db
            .select({
              firstName: users.firstName,
              lastName: users.lastName,
              weightKg: users.weightKg,
              heightCm: users.heightCm,
              age: users.age,
              activityLevel: users.activityLevel,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
          token.profileComplete = row
            ? isUserBodyProfileComplete(row)
            : false;
        } catch {
          token.profileComplete = false;
        }
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
        session.user.profileComplete = token.profileComplete === true;
        if (typeof token.email === "string" && token.email) {
          session.user.email = token.email;
        }
        if (
          typeof token.email === "string" &&
          parseAdminEmails().has(normalizeAdminEmail(token.email))
        ) {
          session.user.role = "admin";
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      try {
        const db = getDb();
        let userId: string | null =
          typeof user?.id === "string" ? user.id : null;

        if (
          isOAuthProvider(account?.provider) &&
          typeof user?.email === "string"
        ) {
          const [row] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, user.email.toLowerCase()))
            .limit(1);
          userId = row?.id ?? null;
        }

        if (!userId) return;
        await db.insert(siteActivityLog).values({
          userId,
          action: "Logowanie",
          deploymentEnv: getAnalyticsDeployment(),
        });
      } catch {
        /* nie blokuj logowania przy błędzie zapisu */
      }
    },
  },
});
