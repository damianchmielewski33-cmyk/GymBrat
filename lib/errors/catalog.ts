/**
 * Katalog błędów GymBrat — jedno źródło prawdy dla serwera i przeglądarki.
 *
 * Każdy kod (`ErrorCode`) ma przypisany:
 * - status HTTP (0 = błąd tylko po stronie przeglądarki),
 * - komunikat dla użytkownika (PL, bez żargonu technicznego),
 * - opis do logów / konsoli (PL, dla dewelopera),
 * - poziom ważności (`warn` = błąd użytkownika / oczekiwany, `error` = awaria).
 *
 * Moduł jest izomorficzny — nie importuj tu nic zależnego od Node ani od DOM.
 */

import { UserMessages } from "@/lib/user-facing-errors";

export type ErrorSeverity = "warn" | "error";

export type ErrorCatalogEntry = {
  /** Status HTTP; 0 = błąd wykryty tylko w przeglądarce. */
  status: number;
  /** Komunikat widoczny dla użytkownika. */
  message: string;
  /** Opis do logów i konsoli. */
  log: string;
  severity: ErrorSeverity;
};

export const ERROR_CATALOG = {
  // ── 4xx ────────────────────────────────────────────────────────────────
  BAD_REQUEST: {
    status: 400,
    message: "Wysłane dane są nieprawidłowe. Sprawdź formularz i spróbuj ponownie.",
    log: "Błędne żądanie (400)",
    severity: "warn",
  },
  INVALID_JSON: {
    status: 400,
    message:
      "Nie udało się odczytać wysłanych danych. Odśwież stronę i spróbuj jeszcze raz.",
    log: "Nieprawidłowy JSON w ciele żądania (400)",
    severity: "warn",
  },
  VALIDATION_FAILED: {
    status: 400,
    message:
      "Niektóre pola są wypełnione niepoprawnie. Popraw dane i spróbuj ponownie.",
    log: "Walidacja danych nie powiodła się (400)",
    severity: "warn",
  },
  UNAUTHORIZED: {
    status: 401,
    message: UserMessages.sessionExpired,
    log: "Brak ważnej sesji użytkownika (401)",
    severity: "warn",
  },
  FORBIDDEN: {
    status: 403,
    message: "Nie masz uprawnień do wykonania tej czynności.",
    log: "Brak uprawnień (403)",
    severity: "warn",
  },
  CSRF_FAILED: {
    status: 403,
    message: UserMessages.securityBlocked,
    log: "Weryfikacja CSRF nie powiodła się (403)",
    severity: "warn",
  },
  ORIGIN_BLOCKED: {
    status: 403,
    message: UserMessages.originBlocked,
    log: "Żądanie z niedozwolonego Origin (403)",
    severity: "warn",
  },
  NOT_FOUND: {
    status: 404,
    message:
      "Nie znaleziono żądanych danych. Być może zostały usunięte albo link jest nieaktualny.",
    log: "Zasób nie istnieje (404)",
    severity: "warn",
  },
  METHOD_NOT_ALLOWED: {
    status: 405,
    message: "Ta operacja nie jest dostępna dla wybranego adresu.",
    log: "Niedozwolona metoda HTTP (405)",
    severity: "warn",
  },
  REQUEST_TIMEOUT: {
    status: 408,
    message: "Serwer nie doczekał się na dane z Twojego urządzenia. Spróbuj ponownie.",
    log: "Przekroczony czas wysyłania żądania (408)",
    severity: "warn",
  },
  CONFLICT: {
    status: 409,
    message:
      "Te dane zostały w międzyczasie zmienione. Odśwież stronę i spróbuj ponownie.",
    log: "Konflikt stanu danych (409)",
    severity: "warn",
  },
  GONE: {
    status: 410,
    message: "Ten zasób nie jest już dostępny.",
    log: "Zasób trwale usunięty (410)",
    severity: "warn",
  },
  PAYLOAD_TOO_LARGE: {
    status: 413,
    message: "Wysyłany plik lub zestaw danych jest za duży. Wybierz mniejszy i spróbuj ponownie.",
    log: "Ciało żądania zbyt duże (413)",
    severity: "warn",
  },
  UNSUPPORTED_MEDIA_TYPE: {
    status: 415,
    message: "Ten typ pliku nie jest obsługiwany. Wybierz inny format.",
    log: "Nieobsługiwany typ treści (415)",
    severity: "warn",
  },
  UNPROCESSABLE: {
    status: 422,
    message:
      "Nie udało się przetworzyć tych danych. Sprawdź ich poprawność i spróbuj ponownie.",
    log: "Dane poprawne składniowo, ale nieprzetwarzalne (422)",
    severity: "warn",
  },
  RATE_LIMITED: {
    status: 429,
    message: UserMessages.rateLimited,
    log: "Przekroczony limit żądań (429)",
    severity: "warn",
  },
  CLIENT_CLOSED: {
    status: 499,
    message: "Połączenie zostało przerwane.",
    log: "Klient zamknął połączenie przed odpowiedzią (499)",
    severity: "warn",
  },

  // ── 5xx ────────────────────────────────────────────────────────────────
  INTERNAL: {
    status: 500,
    message:
      "Wystąpił nieoczekiwany błąd serwera. Spróbuj ponownie za chwilę — jeśli problem wróci, zgłoś go, podając kod referencyjny.",
    log: "Wewnętrzny błąd serwera (500)",
    severity: "error",
  },
  NOT_IMPLEMENTED: {
    status: 501,
    message: "Ta funkcja nie jest jeszcze dostępna.",
    log: "Funkcja niezaimplementowana (501)",
    severity: "error",
  },
  BAD_GATEWAY: {
    status: 502,
    message:
      "Zewnętrzna usługa odpowiedziała błędem. Spróbuj ponownie za chwilę.",
    log: "Błędna odpowiedź usługi zewnętrznej (502)",
    severity: "error",
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    message:
      "Usługa jest chwilowo niedostępna (przeciążenie lub prace techniczne). Spróbuj ponownie za kilka minut.",
    log: "Usługa niedostępna — baza danych lub zależność (503)",
    severity: "error",
  },
  GATEWAY_TIMEOUT: {
    status: 504,
    message: "Serwer zbyt długo odpowiadał. Spróbuj ponownie za chwilę.",
    log: "Przekroczony czas oczekiwania na serwer lub usługę zewnętrzną (504)",
    severity: "error",
  },

  // ── tylko przeglądarka (status 0) ──────────────────────────────────────
  NETWORK: {
    status: 0,
    message: UserMessages.networkOrServer,
    log: "Brak połączenia z serwerem (błąd sieci)",
    severity: "error",
  },
  TIMEOUT: {
    status: 0,
    message: "Operacja trwała zbyt długo. Sprawdź połączenie i spróbuj ponownie.",
    log: "Przekroczony czas operacji po stronie przeglądarki",
    severity: "error",
  },
  CHUNK_LOAD: {
    status: 0,
    message:
      "Nie udało się pobrać części aplikacji — prawdopodobnie wyszła nowa wersja. Odśwież stronę.",
    log: "Błąd ładowania fragmentu aplikacji (ChunkLoadError)",
    severity: "error",
  },
  CLIENT_RUNTIME: {
    status: 0,
    message:
      "Coś poszło nie tak po stronie aplikacji. Spróbuj ponownie lub odśwież stronę.",
    log: "Nieobsłużony błąd w przeglądarce",
    severity: "error",
  },
  RENDER: {
    status: 0,
    message:
      "Nie udało się wyświetlić tego ekranu. Spróbuj ponownie lub odśwież stronę.",
    log: "Błąd renderowania widoku (React error boundary)",
    severity: "error",
  },
  UNKNOWN: {
    status: 0,
    message: "Wystąpił nieznany błąd. Spróbuj ponownie lub odśwież stronę.",
    log: "Nieznany błąd",
    severity: "error",
  },
} as const satisfies Record<string, ErrorCatalogEntry>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

export const ERROR_CODES = Object.keys(ERROR_CATALOG) as ErrorCode[];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(ERROR_CATALOG, value);
}

export function catalogEntry(code: ErrorCode): ErrorCatalogEntry {
  return ERROR_CATALOG[code];
}

const STATUS_TO_CODE: Readonly<Record<number, ErrorCode>> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  405: "METHOD_NOT_ALLOWED",
  408: "REQUEST_TIMEOUT",
  409: "CONFLICT",
  410: "GONE",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE",
  429: "RATE_LIMITED",
  499: "CLIENT_CLOSED",
  500: "INTERNAL",
  501: "NOT_IMPLEMENTED",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT",
};

/** Kod domyślny dla statusu HTTP (nieznane 4xx → BAD_REQUEST, 5xx → INTERNAL). */
export function codeForStatus(status: number): ErrorCode {
  const exact = STATUS_TO_CODE[status];
  if (exact) return exact;
  if (status >= 500) return "INTERNAL";
  if (status >= 400) return "BAD_REQUEST";
  return "UNKNOWN";
}

const CSRF_HINT = /csrf|sesja bezpiecze[ńn]stwa|bezpiecze[ńn]stwa wygas/i;
const ORIGIN_HINT =
  /origin|niedozwolonej witryny|[źz]r[óo]d[łl]o [żz][ąa]dania|nie jest na li[śs]cie|polityk[ai] przegl[ąa]darki/i;

/** Rozróżnia powody 403 po treści komunikatu z API. */
export function classifyForbidden(serverMessage?: string | null): ErrorCode {
  const msg = serverMessage ?? "";
  if (CSRF_HINT.test(msg)) return "CSRF_FAILED";
  if (ORIGIN_HINT.test(msg)) return "ORIGIN_BLOCKED";
  return "FORBIDDEN";
}

/** Kod dla odpowiedzi HTTP: priorytet ma jawny `code` z API, potem status i treść. */
export function codeFromResponse(
  status: number,
  serverMessage?: string | null,
  serverCode?: unknown,
): ErrorCode {
  if (isErrorCode(serverCode)) return serverCode;
  if (status === 403) return classifyForbidden(serverMessage);
  if (status === 400 && /json/i.test(serverMessage ?? "")) return "INVALID_JSON";
  return codeForStatus(status);
}

const GENERIC_ENGLISH =
  /^(unauthorized|forbidden|not found|bad request|rate limit(ed)?|csrf|internal server error|invalid json|too many requests|service unavailable|error|failed)\.?$/i;

const TECHNICAL_HINT =
  /HTTP\s*\d|JSON|Zod|ECONN|fetch|TypeError|SyntaxError|ReferenceError|RangeError|SQLITE|libsql|\bat\s+\S+\s+\(|stack|undefined|\bnull\b|\[object/i;

/** Czy komunikat z serwera można pokazać użytkownikowi bez przeróbek. */
export function isSafeServerMessage(message: unknown): message is string {
  if (typeof message !== "string") return false;
  const trimmed = message.trim();
  if (trimmed.length < 3 || trimmed.length > 240) return false;
  if (GENERIC_ENGLISH.test(trimmed)) return false;
  if (TECHNICAL_HINT.test(trimmed)) return false;
  return true;
}

/** Komunikat dla użytkownika: własny z API (jeśli bezpieczny) albo z katalogu. */
export function resolveUserMessage(
  code: ErrorCode,
  serverMessage?: unknown,
): string {
  if (isSafeServerMessage(serverMessage)) return serverMessage.trim();
  return ERROR_CATALOG[code].message;
}

export type ErrorLineInput = {
  side: "serwer" | "przeglądarka";
  code: ErrorCode;
  status: number;
  message: string;
  method?: string;
  path?: string;
  requestId?: string;
  extra?: Record<string, unknown>;
};

const LINE_EXTRA_MAX = 700;

/** Jedna czytelna linia do konsoli / logów — taka sama po obu stronach. */
export function formatErrorLine(input: ErrorLineInput): string {
  const status = input.status > 0 ? String(input.status) : "CLIENT";
  const where =
    input.method || input.path
      ? ` ${[input.method, input.path].filter(Boolean).join(" ")}`
      : "";
  const ref = input.requestId ? ` (ref ${input.requestId})` : "";
  let extra = "";
  if (input.extra && Object.keys(input.extra).length > 0) {
    try {
      const json = JSON.stringify(input.extra);
      extra = ` ${json.length > LINE_EXTRA_MAX ? `${json.slice(0, LINE_EXTRA_MAX)}…` : json}`;
    } catch {
      extra = "";
    }
  }
  return `[GymBrat][${input.side}][${status}][${input.code}]${where} — ${input.message}${ref}${extra}`;
}
