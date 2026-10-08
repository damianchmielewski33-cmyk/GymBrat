import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
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
  isGoogleAuthConfigured,
  resolveGoogleSignInUser,
} from "@/lib/google-auth";

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
            // To samo e-mail co konto hasłowe → jedno konto GymBrat.
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
      if (account?.provider !== "google") return true;
      const email =
        typeof profile?.email === "string" ? profile.email.trim() : "";
      if (!email) return false;
      // Google czasem nie potwierdza e-maila — nie wpuszczamy bez weryfikacji.
      if (profile && "email_verified" in profile && profile.email_verified === false) {
        return false;
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google") {
        const email =
          (typeof profile?.email === "string" && profile.email) ||
          (typeof user?.email === "string" && user.email) ||
          "";
        const providerAccountId =
          typeof account.providerAccountId === "string"
            ? account.providerAccountId
            : "";
        const name =
          (typeof profile?.name === "string" && profile.name) ||
          (typeof user?.name === "string" && user.name) ||
          null;

        const resolved = await resolveGoogleSignInUser({
          email,
          name,
          providerAccountId,
        });
        if (!resolved) {
          throw new Error("Nie udało się utworzyć lub połączyć konta Google.");
        }
        token.id = resolved.id;
        token.sub = resolved.id;
        token.email = resolved.email;
        token.role = resolved.role;
        if (resolved.name) token.name = resolved.name;
        return token;
      }

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

      // Uzupełnij e-mail z DB tylko gdy brakuje w JWT (stare sesje).
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
        if (typeof token.email === "string" && token.email) {
          session.user.email = token.email;
        }
        // Główny admin zawsze widoczny jako admin w sesji klienta.
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

        // Po Google JWT ma już nasze id, ale event dostaje profil OAuth — szukaj po e-mailu.
        if (account?.provider === "google" && typeof user?.email === "string") {
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
