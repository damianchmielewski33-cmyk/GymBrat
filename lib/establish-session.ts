import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { getAuthSecret } from "@/lib/auth-secret";
import { authCookiesForEmbed, useSecureAuthCookies } from "@/lib/auth-cookies";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export type SessionUserPayload = {
  id: string;
  email: string;
  name?: string;
  role: "zawodnik" | "trener" | "admin";
};

function sessionCookieName(): string {
  const configured = authCookiesForEmbed()?.sessionToken?.name;
  if (configured) return configured;
  return useSecureAuthCookies()
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

/**
 * Ustawia cookie sesji Auth.js bez ponownego `authorize` / round-tripu HTTP.
 * Po rejestracji omija race Turso (read-after-write) oraz problemy CSRF w iframe.
 */
export async function establishCredentialsSession(
  user: SessionUserPayload,
): Promise<boolean> {
  const secret = getAuthSecret();
  if (!secret) return false;

  const name = sessionCookieName();
  const secure = useSecureAuthCookies();
  const embed = authCookiesForEmbed()?.sessionToken?.options;

  try {
    const token = await encode({
      token: {
        id: user.id,
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      secret,
      maxAge: SESSION_MAX_AGE_SEC,
      salt: name,
    });

    const jar = await cookies();
    jar.set(name, token, {
      httpOnly: embed?.httpOnly ?? true,
      secure: embed?.secure ?? secure,
      sameSite:
        (embed?.sameSite as "lax" | "none" | "strict" | undefined) ??
        (secure ? "none" : "lax"),
      path: embed?.path ?? "/",
      maxAge: SESSION_MAX_AGE_SEC,
      ...(embed?.partitioned ? { partitioned: true } : {}),
    });
    return true;
  } catch {
    return false;
  }
}
