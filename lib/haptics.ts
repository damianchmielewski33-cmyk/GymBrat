/**
 * Wibracje / haptyka: `navigator.vibrate` w przeglądarce oraz most
 * `AwpAndroid.vibrate` w WebView APK (gdy dostępny).
 *
 * iOS Safari nie wspiera Vibration API — wywołanie jest no-op.
 */

export type HapticPattern = number[];

/** Lekkie potwierdzenie (skan, krótki tap). */
export const HAPTIC_TAP: HapticPattern = [40];

/** Koniec przerwy między seriami. */
export const HAPTIC_REST_END: HapticPattern = [140, 60, 140, 60, 200];

/** Ostatnia seria ćwiczenia zaliczona. */
export const HAPTIC_EXERCISE_DONE: HapticPattern = [80, 50, 140];

/** Cały trening ukończony (wszystkie serie / zapis). */
export const HAPTIC_WORKOUT_DONE: HapticPattern = [100, 50, 100, 50, 220];

/** Pobicie rekordu / NOWY MAX. */
export const HAPTIC_NEW_MAX: HapticPattern = [50, 40, 50, 40, 50, 70, 260];

function patternToCsv(pattern: HapticPattern): string {
  return pattern.map((n) => Math.max(0, Math.round(n))).join(",");
}

function tryNativeBridge(pattern: HapticPattern): boolean {
  if (typeof window === "undefined") return false;
  const vibrate = window.AwpAndroid?.vibrate;
  if (typeof vibrate !== "function") return false;
  try {
    vibrate.call(window.AwpAndroid, patternToCsv(pattern));
    return true;
  } catch {
    return false;
  }
}

function tryNavigatorVibrate(pattern: HapticPattern): boolean {
  if (typeof navigator === "undefined") return false;
  const vibrate = navigator.vibrate?.bind(navigator);
  if (typeof vibrate !== "function") return false;
  try {
    return Boolean(vibrate(pattern));
  } catch {
    return false;
  }
}

/** Uruchamia wzorzec wibracji. Zwraca true, gdy urządzenie przyjęło sygnał. */
export function vibrate(pattern: HapticPattern): boolean {
  if (!Array.isArray(pattern) || pattern.length === 0) return false;
  if (tryNativeBridge(pattern)) return true;
  return tryNavigatorVibrate(pattern);
}

export function hapticTap() {
  vibrate(HAPTIC_TAP);
}

export function hapticRestEnd() {
  vibrate(HAPTIC_REST_END);
}

export function hapticExerciseDone() {
  vibrate(HAPTIC_EXERCISE_DONE);
}

export function hapticWorkoutDone() {
  vibrate(HAPTIC_WORKOUT_DONE);
}

export function hapticNewMax() {
  vibrate(HAPTIC_NEW_MAX);
}
