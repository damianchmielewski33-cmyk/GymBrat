import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { getAnalyticsDeployment } from "@/lib/analytics-deployment";
import { siteActivityLog, users } from "@/db/schema";
import { getAuthSecret } from "@/lib/auth-secret";
import { resolveEffectiveRole } from "@/lib/admin-config";
import { syncAdminRoleOnLogin } from "@/lib/admin-session";
import {
  findUserByOAuthLink,
  isFacebookAuthConfigured,
  isGoogleAuthConfigured,
  resolveOAuthSignIn,
  type OAuthProviderId,
} from "@/lib/google-auth";
import { getAccountAuthState, isTokenRevoked } from "@/lib/account-auth-state";
import { signTakeoverToken } from "@/lib/account-takeover";
import { logAuthFailure } from "@/lib/security-events";
import { isUserBodyProfileComplete } from "@/lib/profile-complete";
import { LOGIN_RATE_LIMITED_CODE } from "@/lib/auth-error-codes";
import {
  checkRateLimitAsync,
  clientIpFromHeaders,
  RATE,
} from "@/lib/rate-limit";

/** Zbyt wiele prób logowania — `code` trafia do klienta w wyniku `signIn()`. */
export class LoginRateLimited extends CredentialsSignin {
  code = LOGIN_RATE_LIMITED_CODE;
}

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
      async authorize(credentials, request) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const rawRole = credentials?.role as string | undefined;
        const role: "zawodnik" | "trener" =
          rawRole === "trener" ? "trener" : "zawodnik";
        if (!email || !password) return null;

        // Limit prób logowania (przed zapytaniem do bazy i bcrypt): osobno na IP i na konto.
        const [byIp, byEmail] = await Promise.all([
          checkRateLimitAsync(
            `login-ip:${clientIpFromHeaders(request.headers)}`,
            RATE.loginIp.limit,
            RATE.loginIp.windowMs,
          ),
          checkRateLimitAsync(
            `login-email:${email.trim().toLowerCase()}`,
            RATE.loginEmail.limit,
            RATE.loginEmail.windowMs,
          ),
        ]);
        if (!byIp.ok || !byEmail.ok) throw new LoginRateLimited();

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

        const effectiveRole = await syncAdminRoleOnLogin({
          id: user.id,
          email: user.email,
          appRole: user.appRole,
          emailVerified: user.emailVerifiedAt != null,
        });
        // Admin loguje się niezależnie od wybranej zakładki; pozostali tylko w swojej roli.
        if (effectiveRole !== "admin" && effectiveRole !== role) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: effectiveRole,
          sv: user.sessionVersion,
        };
      },
    }),
    ...(isGoogleAuthConfigured()
      ? [
          Google({
            authorization: {
              params: {
                scope: "openid email profile",
              },
            },
          }),
        ]
      : []),
    ...(isFacebookAuthConfigured() ? [Facebook({})] : []),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ account, profile, user }) {
      if (!isOAuthProvider(account?.provider)) return true;
      const { email, name, givenName, familyName, emailVerified } = oauthProfileFields(
        profile,
        user,
      );
      const providerAccountId =
        typeof account.providerAccountId === "string" ? account.providerAccountId : "";
      try {
        // Decyzja i mutacja tylko tutaj (ADR 0001 D3); odmowa = przekierowanie bez sesji.
        const decision = await resolveOAuthSignIn({
          provider: account.provider,
          providerAccountId,
          email,
          providerEmailVerified: emailVerified === true,
          name,
          givenName,
          familyName,
        });
        if (decision.kind === "reject") return `/login?error=${decision.code}`;
        if (decision.kind === "takeover_confirm") {
          const token = signTakeoverToken({ uid: decision.userId, pid: providerAccountId });
          return `/login/zabezpiecz-konto?t=${encodeURIComponent(token)}`;
        }
        return true;
      } catch (err) {
        logAuthFailure("auth.signIn.oauth", err);
        return "/login?error=OAuthSignInFailed";
      }
    },
    async jwt({ token, user, account, trigger }) {
      if (account && isOAuthProvider(account.provider)) {
        // Konto ustalone w `signIn` — tu tylko odczyt po powiązaniu.
        const linked = await findUserByOAuthLink(account.provider, account.providerAccountId);
        if (!linked) throw new Error("OAuth link missing after signIn");
        token.id = linked.id;
        token.sub = linked.id;
        token.email = linked.email;
        token.role = await syncAdminRoleOnLogin(linked);
        token.sv = linked.sessionVersion;
      } else if (user) {
        if (typeof user.id === "string") {
          token.id = user.id;
          token.sub = user.id;
        }
        if (user.role) token.role = user.role;
        if (typeof user.email === "string" && user.email) token.email = user.email;
        token.sv = user.sv ?? 0;
      } else {
        const uid =
          typeof token.id === "string" ? token.id : typeof token.sub === "string" ? token.sub : "";
        token.id = uid;
        try {
          // Unieważnienie sesji (ADR 0001 D5): brak konta albo inna wersja sesji = wylogowanie.
          const state = await getAccountAuthState(uid);
          if (isTokenRevoked(token, state)) return null;
          token.email = state.email;
          token.role = resolveEffectiveRole(state);
        } catch {
          /* chwilowy błąd bazy nie wylogowuje (cache 60 s, kolejne odświeżenie sprawdzi ponownie) */
        }
      }

      const userId = typeof token.id === "string" ? token.id : "";

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
          // Nie degraduj znanego `true` — chwilowy błąd DB + proxy dawały pętlę
          // `/` ↔ `/complete-profile` (na iOS wygląda jak skaczący ekran).
          if (token.profileComplete !== true) {
            token.profileComplete = false;
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
        session.user.profileComplete = token.profileComplete === true;
        if (typeof token.email === "string" && token.email) {
          session.user.email = token.email;
        }
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      try {
        const userId =
          isOAuthProvider(account?.provider) && account
            ? ((await findUserByOAuthLink(account.provider, account.providerAccountId))?.id ?? null)
            : typeof user?.id === "string"
              ? user.id
              : null;

        if (!userId) return;
        await getDb().insert(siteActivityLog).values({
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
