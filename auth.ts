import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";
import { siteActivityLog, users } from "@/db/schema";
import { getAuthSecret } from "@/lib/auth-secret";
import {
  normalizeAdminEmail,
  parseAdminEmails,
} from "@/lib/admin-config";

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
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    async jwt({ token, user }) {
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
