import type { NextAuthConfig } from "next-auth";

/**
 * Czy sesja Auth.js ma iść na HTTPS (prefiks `__Secure-` / CHIPS).
 * Na localhost (HTTP) zostajemy przy domyślnych cookies Auth.js.
 */
export function useSecureAuthCookies(): boolean {
  const authUrl =
    process.env.AUTH_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "";
  if (authUrl.startsWith("https://")) return true;
  if (authUrl.startsWith("http://")) return false;
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    return true;
  }
  return false;
}

/**
 * Cookies Auth.js pod osadzenie w cross-origin iframe (AWP).
 *
 * Domyślne `__Host-authjs.csrf-token` + SameSite=Lax są blokowane jako
 * third-party cookies w iframe. CHIPS (Partitioned + SameSite=None + Secure)
 * pozwala utrzymać CSRF i sesję w partycji (top-level site × gym-brat).
 *
 * Uwaga: `__Host-` nie łączy się z `Partitioned`, stąd CSRF na `__Secure-`.
 */
export function authCookiesForEmbed(): NextAuthConfig["cookies"] | undefined {
  if (!useSecureAuthCookies()) return undefined;

  const base = {
    httpOnly: true,
    sameSite: "none" as const,
    path: "/",
    secure: true,
    partitioned: true,
  };

  return {
    sessionToken: {
      name: "__Secure-authjs.session-token",
      options: { ...base },
    },
    callbackUrl: {
      name: "__Secure-authjs.callback-url",
      options: { ...base },
    },
    csrfToken: {
      name: "__Secure-authjs.csrf-token",
      options: { ...base },
    },
  };
}

/** Opcje cookie aplikacji (np. gymbrat_xsrf) w tym samym modelu co Auth.js. */
export function appEmbedCookieOptions(httpOnly: boolean): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "none";
  path: string;
  partitioned?: boolean;
} {
  if (!useSecureAuthCookies()) {
    return {
      httpOnly,
      secure: false,
      sameSite: "lax",
      path: "/",
    };
  }
  return {
    httpOnly,
    secure: true,
    sameSite: "none",
    path: "/",
    partitioned: true,
  };
}
