/** Kody błędów logowania przekazywane do klienta przez `signIn()` (pole `code`). */
export const LOGIN_RATE_LIMITED_CODE = "rate_limited";

/** Kody odmowy logowania OAuth w `/login?error=<kod>` (ADR 0001 D3). */
export const OAUTH_ERROR_CODES = [
  "OAuthEmailUnverified",
  "OAuthLinkRefused",
  "OAuthNoEmail",
  "OAuthSignInFailed",
] as const;

export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

/** `/login?session=expired` — sesja unieważniona (przejęcie konta, zmiana wersji sesji). */
export const SESSION_EXPIRED_PARAM = "expired";
