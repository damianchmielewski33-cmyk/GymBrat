/**
 * Komunikaty dla użytkownika końcowego (PL, ton „biznesowy” zamiast technicznego).
 * Używane w akcjach serwerowych, API i — tam gdzie potrzeba — w komponentach klienckich.
 */

import type { ZodError } from "zod";

export const UserMessages = {
  sessionExpired:
    "Sesja wygasła lub jesteś wylogowany. Zaloguj się ponownie, a potem wróć do tej czynności.",
  rateLimited:
    "Wykonano zbyt wiele zapisów w krótkim czasie. Poczekaj około minuty i spróbuj ponownie.",
  securityBlocked:
    "Żądanie zostało zablokowane ze względów bezpieczeństwa. Odśwież stronę i — jeśli problem wróci — zaloguj się ponownie.",
  originBlocked:
    "Połączenie z aplikacją zostało odrzucone przez zabezpieczenia. Użyj oficjalnego adresu strony i odśwież okno.",
  networkOrServer:
    "Nie udało się połączyć z serwerem. Sprawdź połączenie z internetem, odśwież stronę i spróbuj jeszcze raz.",
  workoutSaveUnknown:
    "Nie udało się zapisać treningu. Spróbuj ponownie za chwilę lub skontaktuj się z pomocą, jeśli się powtarza.",
  workoutDataInvalid:
    "Dane treningu nie przeszły weryfikacji. Odśwież stronę i spróbuj zapisać trening ponownie.",
  workoutSetsInvalid:
    "Sprawdź serie ćwiczeń — w każdej serii powtórzenia i ciężar muszą być poprawnymi liczbami.",
  workoutTooManyItems:
    "Lista ćwiczeń lub serii jest zbyt długa do jednego zapisu. Zapisz trening z mniejszą liczbą pozycji lub podziel go na części.",
  workoutPlanMismatch:
    "Wybrany plan treningowy nie jest przypisany do Twojego konta. Odśwież listę planów i wybierz plan ponownie.",
  workoutJsonBroken:
    "Nie udało się odczytać danych z przeglądarki. Odśwież stronę i spróbuj zapisać trening jeszcze raz.",
  coachPayloadInvalid:
    "Dane bieżącej sesji są niekompletne. Wróć do listy ćwiczeń lub odśwież trening i spróbuj ponownie.",
  coachNoExercises: "Brak ćwiczeń w sesji — najpierw wczytaj plan lub dodaj ćwiczenia.",
  coachAiTimeout:
    "Trener AI nie zdążył z odpowiedzią. Spróbuj ponownie za chwilę (przycisk „Odśwież”).",
  coachAiUnavailable:
    "Trener AI jest chwilowo niedostępny. Sprawdź połączenie z internetem lub spróbuj ponownie później.",
  coachAiQuota:
    "Limit zapytań do trenera AI został chwilowo wyczerpany. Spróbuj ponownie za kilka minut.",
  coachChatNoMessage: "Napisz wiadomość do trenera, zanim wyślesz zapytanie.",
  coachChatBadThread:
    "Nie udało się odczytać historii czatu. Wyślij krótszą wiadomość lub zacznij wątek od nowa.",
  coachChatLastMustBeUser:
    "Aby dostać odpowiedź, wyślij najpierw swoją wiadomość (ostatnia w wątku musi być od Ciebie).",
  coachChatEmptyReply:
    "Trener nie zwrócił treści odpowiedzi. Spróbuj zadać pytanie jeszcze raz, nieco inaczej.",
  mealSuggestionsNoSession: "Musisz być zalogowany, aby wygenerować propozycje posiłków.",
} as const;

/** Zapis treningu — mapowanie po `error` z API + opcjonalnie HTTP. */
export function mapWorkoutCompleteClientError(
  status: number,
  bodyError?: string | null,
): string {
  const raw = (bodyError ?? "").trim();

  if (status === 401) return UserMessages.sessionExpired;
  if (status === 429) return UserMessages.rateLimited;
  if (status === 403) {
    const lower = raw.toLowerCase();
    if (
      raw === "CSRF" ||
      lower.includes("csrf") ||
      lower.includes("sesja bezpieczeństwa") ||
      lower.includes("bezpieczeństwa wygasła")
    ) {
      return UserMessages.securityBlocked;
    }
    if (
      raw.includes("Origin") ||
      raw.includes("origin") ||
      lower.includes("niedozwolonej witryny") ||
      lower.includes("źródło żądania") ||
      lower.includes("nie jest na liście")
    ) {
      return UserMessages.originBlocked;
    }
    return UserMessages.securityBlocked;
  }

  switch (raw) {
    case "Rate limit":
      return UserMessages.rateLimited;
    case "Brak autoryzacji":
    case "Unauthorized":
      return UserMessages.sessionExpired;
    case "Nieprawidłowy JSON":
      return UserMessages.workoutJsonBroken;
    case "Nieprawidłowe dane":
      return UserMessages.workoutDataInvalid;
    case "Nieprawidłowy plan treningowy":
      return UserMessages.workoutPlanMismatch;
    default:
      break;
  }

  if (raw.length > 0 && raw.length < 200 && !looksTechnical(raw)) {
    return raw;
  }

  if (status >= 500) return UserMessages.networkOrServer;
  if (status === 400) return UserMessages.workoutDataInvalid;
  return UserMessages.workoutSaveUnknown;
}

function looksTechnical(s: string): boolean {
  return /HTTP\s*\d|JSON|Zod|ECONN|fetch|TypeError|SyntaxError|stack/i.test(s);
}

export function mapUnknownFetchError(
  err: unknown,
  fallback: string = UserMessages.networkOrServer,
): string {
  if (!(err instanceof Error)) return fallback;
  const m = err.message;
  if (m === "timeout" || m.includes("timeout")) return UserMessages.coachAiTimeout;
  if (/network|failed to fetch|load failed/i.test(m)) return UserMessages.networkOrServer;
  if (looksTechnical(m)) return fallback;
  return m.length > 0 && m.length < 240 ? m : fallback;
}

export function workoutCompleteZodMessage(err: ZodError): string {
  const issues = err.issues;
  const pathStr = issues.map((i) => i.path.join(".")).join(" ");
  if (/weight|reps|sets|exercises/i.test(pathStr)) {
    return UserMessages.workoutSetsInvalid;
  }
  if (issues.some((i) => i.code === "too_big")) {
    return UserMessages.workoutTooManyItems;
  }
  return UserMessages.workoutDataInvalid;
}

export function activeWorkoutCoachZodMessage(err: ZodError): string {
  const pathStr = err.issues.map((i) => i.path.join(".")).join(" ");
  if (/sets|weight|reps|exercises/i.test(pathStr)) {
    return UserMessages.coachPayloadInvalid;
  }
  return UserMessages.coachPayloadInvalid;
}

export function mapCoachAiThrowable(err: unknown): string {
  if (!(err instanceof Error)) return UserMessages.coachAiUnavailable;
  const m = err.message;
  if (/rate limit|429|quota|RESOURCE_EXHAUSTED/i.test(m)) return UserMessages.coachAiQuota;
  if (/parse|JSON|HTTP\s*4\d\d/i.test(m)) return UserMessages.coachAiUnavailable;
  return UserMessages.coachAiUnavailable;
}
