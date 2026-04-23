/**
 * Auth.js wymaga niepustego `secret` do JWT i endpointów `/api/auth/*`.
 * Ustaw `AUTH_SECRET` lub `NEXTAUTH_SECRET` w `.env.local` (nigdy nie używamy
 * stałego fallbacku — groziłoby to podpisem JWT znanym sekretem przy błędnej konfiguracji).
 */
export function getAuthSecret(): string | undefined {
  const fromEnv = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return undefined;
}
