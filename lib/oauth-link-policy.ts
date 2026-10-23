import type { OAuthErrorCode } from "@/lib/auth-error-codes";

/**
 * Reguły logowania OAuth (ADR 0001 D3, tabela decyzji) jako czysta funkcja — bez bazy.
 * Wykonanie decyzji: `resolveOAuthSignIn` w `lib/google-auth.ts`.
 */
export type OAuthDecision =
  | { kind: "login_linked"; userId: string }
  | { kind: "create"; emailVerified: boolean }
  | { kind: "link_existing"; userId: string }
  | { kind: "takeover_confirm"; userId: string }
  | { kind: "reject"; code: OAuthErrorCode };

export type OAuthDecisionInput = {
  provider: "google" | "facebook";
  /** Znormalizowany e-mail od dostawcy; może być "". */
  email: string;
  /** Google: `email_verified === true`; Facebook: zawsze false. */
  providerEmailVerified: boolean;
  /** Właściciel powiązania (provider, providerAccountId), jeśli istnieje. */
  linkedUserId: string | null;
  accountByEmail: { id: string; emailVerified: boolean; isAdmin: boolean } | null;
};

export function decideOAuthSignIn(input: OAuthDecisionInput): OAuthDecision {
  // BR-8: istniejące powiązanie zawsze wygrywa i nigdy nie jest przenoszone.
  if (input.linkedUserId) return { kind: "login_linked", userId: input.linkedUserId };
  if (!input.email) return { kind: "reject", code: "OAuthNoEmail" };

  const account = input.accountByEmail;
  if (input.provider === "facebook") {
    // Facebook nie potwierdza adresu — nigdy nie łączy kont automatycznie.
    return account
      ? { kind: "reject", code: "OAuthLinkRefused" }
      : { kind: "create", emailVerified: false };
  }

  // Ta sama odmowa przy istniejącym i nieistniejącym koncie (brak enumeracji, LR-29).
  if (!input.providerEmailVerified) return { kind: "reject", code: "OAuthEmailUnverified" };
  if (!account) return { kind: "create", emailVerified: true };
  if (account.emailVerified) return { kind: "link_existing", userId: account.id };
  // Admin bez weryfikacji nigdy nie jest przejmowany (ADR 0001 D2 pkt 3).
  if (account.isAdmin) return { kind: "reject", code: "OAuthLinkRefused" };
  return { kind: "takeover_confirm", userId: account.id };
}
