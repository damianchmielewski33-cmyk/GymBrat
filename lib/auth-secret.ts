/**
 * Auth.js wymaga niepustego `secret` do JWT i endpointów `/api/auth/*`.
 * W development można tymczasowo polegać na deterministycznym fallbacku, dopóki
 * uzupełnisz `AUTH_SECRET` w `.env.local`. W produkcji ustaw zmienną w środowisku.
 */
export function getAuthSecret(): string | undefined {
  const fromEnv = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (process.env.NODE_ENV !== "production") {
    return "__gymbrat_dev_only_secret_change_me__";
  }
  return undefined;
}
