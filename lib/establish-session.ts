import { encode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { getAuthSecret } from "@/lib/auth-secret";
import { useSecureAuthCookies } from "@/lib/auth-cookies";

export type CredentialsSessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "zawodnik" | "trener" | "admin";
};

/**
 * Ustawia cookie sesji Auth.js (JWT) bez round-tripu `signIn`.
 * Potrzebne przy mostowaniu sesji z Akademii i auto-loginie po rejestracji.
 */
export async function establishCredentialsSession(
  user: CredentialsSessionUser,
): Promise<boolean> {
  try {
    const secret = getAuthSecret();
    if (!secret) return false;

    const maxAge = 60 * 60 * 24 * 30;
    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name ?? undefined,
        role: user.role,
      },
      secret,
      maxAge,
      salt: useSecureAuthCookies()
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
    });

    const jar = await cookies();
    const secure = useSecureAuthCookies();
    const name = secure
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";

    jar.set(name, token, {
      httpOnly: true,
      sameSite: secure ? "none" : "lax",
      path: "/",
      secure,
      ...(secure ? { partitioned: true } : {}),
      maxAge,
    });
    return true;
  } catch {
    return false;
  }
}
