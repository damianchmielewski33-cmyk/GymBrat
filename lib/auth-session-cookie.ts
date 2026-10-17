/** Nazwy ciasteczek sesji Auth.js / legacy NextAuth (secure i zwykłe). */
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
] as const;

export function hasAuthSessionCookie(
  has: (name: string) => boolean,
): boolean {
  return SESSION_COOKIE_NAMES.some((name) => has(name));
}
