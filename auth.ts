import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { siteActivityLog, users } from "@/db/schema";
import { getFounderUserId } from "@/lib/admin-session";
import { getAuthSecret } from "@/lib/auth-secret";

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

        const founderId = await getFounderUserId();
        if (founderId === user.id) {
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
        });
      } catch {
        /* nie blokuj logowania przy błędzie zapisu */
      }
    },
  },
});
