import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
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

        const storedRole =
          (user.appRole as "zawodnik" | "trener" | null | undefined) ??
          "zawodnik";
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
      if (user?.id) token.id = user.id;
      if (user && "role" in user && user.role) {
        token.role = user.role as "zawodnik" | "trener";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role =
          (token.role as "zawodnik" | "trener" | undefined) ?? "zawodnik";
      }
      return session;
    },
  },
});
