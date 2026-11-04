/**
 * Widoczność mini-paska niedokończonego treningu (US13 / Z63).
 * Jedno sterowanie na ekran: na `/active-workout` jest pełna sesja, na `/treningi`
 * kartę „Niedokończony trening” — mini-pasek tam się nie pokazuje.
 */
const HIDDEN_PREFIXES = ["/active-workout", "/treningi"] as const;

export function isGlobalWorkoutBarRoute(pathname: string): boolean {
  return !HIDDEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function shouldShowGlobalWorkoutBar(input: {
  pathname: string;
  hasSession: boolean;
  hiddenForRoute: boolean;
}): boolean {
  return (
    input.hasSession &&
    !input.hiddenForRoute &&
    isGlobalWorkoutBarRoute(input.pathname)
  );
}
