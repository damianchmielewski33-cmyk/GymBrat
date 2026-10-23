/**
 * Obsługa błędów w przeglądarce — wspólna dla całej aplikacji.
 *
 * `installClientErrorHandling()` (wołane raz z `GlobalErrorHandlers`):
 * - śledzi ostatnie kliknięcie, żeby w logu było widać „po jakim kliknięciu” poleciał błąd,
 * - owija `window.fetch` dla `/api/*`: każdy błąd HTTP (400/401/403/404/429/500/…) i błąd sieci
 *   trafia do konsoli w jednolitym formacie z kodem, statusem i komunikatem dla użytkownika,
 * - łapie `window.onerror` i `unhandledrejection` (czyli m.in. wyjątki z handlerów kliknięć),
 *   mapuje je na kod z katalogu, loguje, pokazuje użytkownikowi komunikat i zgłasza do `/api/client-errors`
 *   (żeby błąd był widoczny także w logach serwera).
 *
 * Konsola: używamy wyłącznie `console.error` — to jedyna metoda zachowana w produkcyjnym bundlu
 * (`compiler.removeConsole` z wyjątkiem `error`).
 */

import { parseAppErrorDigest } from "@/lib/errors/app-error";
import {
  catalogEntry,
  codeFromResponse,
  formatErrorLine,
  isErrorCode,
  resolveUserMessage,
  type ErrorCode,
} from "@/lib/errors/catalog";

export type ClientErrorSource =
  | "fetch"
  | "window-error"
  | "unhandled-rejection"
  | "react-boundary"
  | "resource"
  | "manual";

export type ClientErrorReport = {
  code: ErrorCode;
  status: number;
  /** Komunikat pokazywany użytkownikowi. */
  userMessage: string;
  source: ClientErrorSource;
  detail?: string;
  method?: string;
  path?: string;
  requestId?: string;
  digest?: string;
  click?: string;
  page?: string;
};

type Notifier = (message: string) => void;

const CLIENT_ERRORS_PATH = "/api/client-errors";
const CLICK_WINDOW_MS = 4_000;
const LOG_THROTTLE_MS = 5_000;
const NOTIFY_THROTTLE_MS = 10_000;
const NETWORK_NOTIFY_THROTTLE_MS = 30_000;
const BACKEND_THROTTLE_MS = 60_000;
const BACKEND_MAX_REPORTS = 15;

let notifier: Notifier | null = null;
let nativeFetch: typeof fetch | null = null;
let backendReports = 0;

const lastLogAt = new Map<string, number>();
const lastNotifyAt = new Map<string, number>();
const lastBackendAt = new Map<string, number>();

/** Rejestruje funkcję pokazującą popup z błędem (np. `notifyError` z `useSaveFeedback`). */
export function setClientErrorNotifier(fn: Notifier | null): void {
  notifier = fn;
}

function throttled(map: Map<string, number>, key: string, windowMs: number): boolean {
  const now = Date.now();
  const last = map.get(key);
  if (last !== undefined && now - last < windowMs) return true;
  map.set(key, now);
  if (map.size > 200) {
    for (const [k, t] of map) if (now - t > windowMs * 4) map.delete(k);
  }
  return false;
}

/** Wycina adresy e-mail i query stringi, skraca — bezpieczne do konsoli i raportów. */
export function scrubDetail(text: string, max = 300): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\?[\w%.~+-]+=[^\s"')]*/g, "")
    .slice(0, max);
}

function pathOf(url: string): string | undefined {
  try {
    return new URL(url, window.location.href).pathname;
  } catch {
    return undefined;
  }
}

// ── Ostatnie kliknięcie ───────────────────────────────────────────────────

let lastClick: { desc: string; at: number } | null = null;

function describeElement(node: EventTarget | null): string | null {
  if (!(node instanceof Element)) return null;
  const el =
    node.closest(
      "button,a,[role=button],[role=link],[role=tab],[role=menuitem],input,select,textarea,label,[data-testid]",
    ) ?? node;
  const tag = el.tagName.toLowerCase();
  const isField = tag === "input" || tag === "textarea" || tag === "select";
  const label =
    el.getAttribute("aria-label") ||
    el.getAttribute("data-testid") ||
    el.id ||
    (isField ? el.getAttribute("name") : null) ||
    (isField ? null : (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40));
  return label ? `${tag}:"${scrubDetail(label, 40)}"` : tag;
}

function currentClick(): string | undefined {
  if (!lastClick) return undefined;
  return Date.now() - lastClick.at <= CLICK_WINDOW_MS ? lastClick.desc : undefined;
}

// ── Klasyfikacja wyjątków ─────────────────────────────────────────────────

type Classified = {
  code: ErrorCode;
  detail?: string;
  digest?: string;
  status?: number;
  ignore?: boolean;
};

const NETWORK_HINT = /failed to fetch|networkerror|load failed|network request failed|fetch failed|network error/i;
const CHUNK_HINT =
  /loading (css )?chunk [\w-]+ failed|failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;

export function classifyThrown(reason: unknown): Classified {
  if (typeof reason === "string") {
    return { code: "CLIENT_RUNTIME", detail: scrubDetail(reason) };
  }

  if (reason instanceof Error) {
    const msg = reason.message ?? "";
    if (reason.name === "AbortError") return { code: "CLIENT_CLOSED", ignore: true };
    if (/ResizeObserver loop/i.test(msg)) return { code: "CLIENT_RUNTIME", ignore: true };
    if (reason.name === "ChunkLoadError" || CHUNK_HINT.test(msg)) {
      return { code: "CHUNK_LOAD", detail: scrubDetail(msg) };
    }
    if (reason.name === "TimeoutError" || /timed? ?out/i.test(msg)) {
      return { code: "TIMEOUT", detail: scrubDetail(msg) };
    }
    if (reason instanceof TypeError && NETWORK_HINT.test(msg)) {
      return { code: "NETWORK", detail: scrubDetail(msg) };
    }
    const digest = (reason as { digest?: unknown }).digest;
    const known = parseAppErrorDigest(digest);
    if (known) {
      // Błąd z katalogu rzucony w akcji serwerowej / renderze (np. 429) — kod przeszedł w digeście.
      return { code: known.code, digest: known.ref, detail: scrubDetail(msg) };
    }
    if (typeof digest === "string" && digest) {
      // Błąd z serwera (Server Component / Server Action) — treść jest zamaskowana, ref = digest.
      return { code: "INTERNAL", digest, detail: scrubDetail(msg) };
    }
    return { code: "CLIENT_RUNTIME", detail: scrubDetail(`${reason.name}: ${msg}`) };
  }

  if (reason && typeof reason === "object") {
    const r = reason as { code?: unknown; status?: unknown; error?: unknown; message?: unknown };
    const status = typeof r.status === "number" ? r.status : undefined;
    const message = typeof r.error === "string" ? r.error : typeof r.message === "string" ? r.message : undefined;
    if (isErrorCode(r.code)) return { code: r.code, detail: message && scrubDetail(message), status };
    if (status && status >= 400) {
      return { code: codeFromResponse(status, message), detail: message && scrubDetail(message), status };
    }
    if (message) return { code: "CLIENT_RUNTIME", detail: scrubDetail(message) };
  }

  return { code: "UNKNOWN" };
}

// ── Logowanie do konsoli ──────────────────────────────────────────────────

export function logClientError(report: ClientErrorReport): void {
  const entry = catalogEntry(report.code);
  const message = `${entry.log}${report.detail ? ` (${report.detail})` : ""} → komunikat dla użytkownika: „${report.userMessage}”`;
  const line = formatErrorLine({
    side: "przeglądarka",
    code: report.code,
    status: report.status,
    message,
    method: report.method,
    path: report.path,
    requestId: report.requestId ?? report.digest,
    extra: {
      src: report.source,
      ...(report.click ? { klik: report.click } : null),
      ...(report.page ? { strona: report.page } : null),
    },
  });
  console.error(line);
}

// ── Zgłoszenie do backendu (logi serwera) ────────────────────────────────

function reportToBackend(report: ClientErrorReport): void {
  if (typeof window === "undefined") return;
  if (report.source === "fetch") return; // serwer już zalogował własną odpowiedź
  if (report.code === "NETWORK" || report.code === "CLIENT_CLOSED") return;
  if (backendReports >= BACKEND_MAX_REPORTS) return;
  const key = `${report.code}|${report.page}|${report.source}|${(report.detail ?? "").slice(0, 80)}`;
  if (throttled(lastBackendAt, key, BACKEND_THROTTLE_MS)) return;

  const payload = JSON.stringify({
    code: report.code,
    source: report.source,
    message: report.userMessage.slice(0, 300),
    detail: report.detail?.slice(0, 300),
    digest: report.digest,
    page: report.page,
    click: report.click ? scrubDetail(report.click, 80) : undefined,
  });

  backendReports += 1;
  try {
    if (
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(CLIENT_ERRORS_PATH, new Blob([payload], { type: "application/json" }))
    ) {
      return;
    }
  } catch {
    /* spróbuj fetch */
  }
  const send = nativeFetch ?? (typeof fetch === "function" ? fetch.bind(window) : null);
  void send?.(CLIENT_ERRORS_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => undefined);
}

function maybeNotify(report: ClientErrorReport): void {
  if (!notifier) return;
  const key =
    report.code === "NETWORK" ? "NETWORK" : `${report.code}|${(report.detail ?? "").slice(0, 80)}`;
  const windowMs = report.code === "NETWORK" ? NETWORK_NOTIFY_THROTTLE_MS : NOTIFY_THROTTLE_MS;
  if (throttled(lastNotifyAt, key, windowMs)) return;
  const ref = report.digest ? ` Kod referencyjny: ${report.digest}.` : "";
  notifier(`${report.userMessage}${ref}`);
}

/** Kod, komunikat i kod referencyjny (digest) dla błędu przechwyconego przez error boundary. */
export function describeBoundaryError(error: unknown): {
  code: ErrorCode;
  message: string;
  ref?: string;
} {
  const c = classifyThrown(error);
  const code = c.code === "CLIENT_RUNTIME" ? "RENDER" : c.code;
  return { code, message: catalogEntry(code).message, ref: c.digest };
}

export type HandleClientErrorOptions = {
  /** Kod używany, gdy błąd nie pasuje do żadnej szczegółowej kategorii (zamiast CLIENT_RUNTIME). */
  fallbackCode?: ErrorCode;
  source?: ClientErrorSource;
  /** Pokaż popup z komunikatem (domyślnie tak). */
  notify?: boolean;
  /** Etykieta miejsca, np. nazwa przycisku/akcji. */
  context?: string;
};

/**
 * Centralne wejście: klasyfikuje błąd, loguje do konsoli, zgłasza do backendu i (opcjonalnie)
 * pokazuje komunikat. Zwraca raport albo `null`, gdy błąd został świadomie zignorowany (np. AbortError).
 */
export function handleClientError(
  reason: unknown,
  options: HandleClientErrorOptions = {},
): ClientErrorReport | null {
  const classified = classifyThrown(reason);
  if (classified.ignore) return null;

  const code =
    classified.code === "CLIENT_RUNTIME" && options.fallbackCode
      ? options.fallbackCode
      : classified.code;
  const entry = catalogEntry(code);
  const report: ClientErrorReport = {
    code,
    status: classified.status ?? entry.status,
    userMessage: entry.message,
    source: options.source ?? "manual",
    detail: [options.context, classified.detail].filter(Boolean).join(": ") || undefined,
    digest: classified.digest,
    click: currentClick(),
    page: typeof window !== "undefined" ? window.location.pathname : undefined,
  };

  const logKey = `${report.code}|${report.source}|${report.detail ?? ""}`;
  if (!throttled(lastLogAt, logKey, LOG_THROTTLE_MS)) logClientError(report);

  reportToBackend(report);
  if (options.notify !== false) maybeNotify(report);
  return report;
}

/** Alias czytelny w komponentach: `reportClientError(err, { source: "react-boundary", notify: false })`. */
export const reportClientError = handleClientError;

/**
 * Opakowuje handler (np. `onClick`) tak, by wyjątek — synchroniczny lub asynchroniczny —
 * został zmapowany, zalogowany i pokazany użytkownikowi.
 */
export function guardHandler<A extends unknown[]>(
  fn: (...args: A) => unknown,
  context?: string,
): (...args: A) => unknown {
  return (...args: A) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch((err: unknown) => {
          handleClientError(err, { source: "manual", context });
        });
      }
      return result;
    } catch (err) {
      handleClientError(err, { source: "manual", context });
      return undefined;
    }
  };
}

// ── Opis odpowiedzi API (używane też przez komponenty) ───────────────────

export type ApiErrorInfo = {
  code: ErrorCode;
  status: number;
  message: string;
  requestId?: string;
};

/** Mapuje odpowiedź HTTP z błędem (status + opcjonalne ciało JSON) na kod i komunikat. */
export function describeApiError(
  status: number,
  body?: unknown,
  headerRequestId?: string | null,
): ApiErrorInfo {
  const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const serverMessage = typeof b.error === "string" ? b.error : undefined;
  const code = codeFromResponse(status, serverMessage, b.code);
  const requestId =
    (typeof b.requestId === "string" && b.requestId) || headerRequestId || undefined;
  return { code, status, message: resolveUserMessage(code, serverMessage), requestId };
}

// ── Przechwytywanie fetch ────────────────────────────────────────────────

function requestMeta(
  input: RequestInfo | URL,
  init?: RequestInit,
): { method: string; url: string } {
  const method = (
    init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : (input as Request).url;
  return { method, url };
}

function trackedApiPath(url: string): string | null {
  try {
    const u = new URL(url, window.location.href);
    if (u.origin !== window.location.origin) return null;
    if (!u.pathname.startsWith("/api/")) return null;
    if (u.pathname.startsWith(CLIENT_ERRORS_PATH)) return null;
    return u.pathname;
  } catch {
    return null;
  }
}

async function inspectFailedResponse(
  res: Response,
  meta: { method: string; path: string },
): Promise<void> {
  let loginRedirect = false;
  try {
    loginRedirect = res.redirected && new URL(res.url).pathname === "/login";
  } catch {
    loginRedirect = false;
  }
  const status = loginRedirect ? 401 : res.status;

  let body: unknown;
  if ((res.headers.get("content-type") ?? "").toLowerCase().includes("json")) {
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
  }

  const info = describeApiError(status, body, res.headers.get("x-request-id"));
  const key = `${meta.method} ${meta.path} ${status}`;
  if (throttled(lastLogAt, key, LOG_THROTTLE_MS)) return;

  logClientError({
    code: info.code,
    status: info.status,
    userMessage: info.message,
    source: "fetch",
    method: meta.method,
    path: meta.path,
    requestId: info.requestId,
    click: currentClick(),
    page: window.location.pathname,
  });
}

function installFetchInterceptor(): () => void {
  if (typeof window.fetch !== "function") return () => undefined;
  const original = window.fetch;
  nativeFetch = original.bind(window);
  const native = nativeFetch;

  const patched: typeof fetch = async (input, init) => {
    const meta = requestMeta(input, init);
    const path = trackedApiPath(meta.url);
    try {
      const res = await native(input, init);
      if (path) {
        const failed =
          !res.ok || (res.redirected && /\/login\/?$/.test(new URL(res.url).pathname));
        if (failed) void inspectFailedResponse(res.clone(), { method: meta.method, path });
      }
      return res;
    } catch (err) {
      if (path) {
        const classified = classifyThrown(err);
        if (!classified.ignore && !throttled(lastLogAt, `net:${meta.method} ${path}`, LOG_THROTTLE_MS)) {
          const entry = catalogEntry(classified.code);
          logClientError({
            code: classified.code,
            status: entry.status,
            userMessage: entry.message,
            source: "fetch",
            method: meta.method,
            path,
            detail: classified.detail,
            click: currentClick(),
            page: window.location.pathname,
          });
        }
      }
      throw err;
    }
  };

  window.fetch = patched;
  return () => {
    if (window.fetch === patched) window.fetch = original;
  };
}

// ── Globalne nasłuchiwanie ───────────────────────────────────────────────

const FOREIGN_SOURCE = /^(chrome|moz|safari|safari-web)-extension:\/\//i;

function isForeignScript(filename?: string | null, stack?: string | null): boolean {
  if (filename) {
    if (FOREIGN_SOURCE.test(filename)) return true;
    try {
      return new URL(filename, window.location.href).origin !== window.location.origin;
    } catch {
      return false;
    }
  }
  return Boolean(stack && FOREIGN_SOURCE.test(stack));
}

function onWindowError(event: Event): void {
  const target = event.target;
  if (target && target !== window && target instanceof HTMLElement) {
    // Błąd ładowania zasobu (obrazy pomijamy — brak miniatury nie jest awarią).
    const tag = target.tagName.toLowerCase();
    if (tag !== "script" && tag !== "link") return;
    const src = (target as HTMLScriptElement).src || (target as HTMLLinkElement).href || "";
    const isChunk = /\/_next\/static\//.test(src);
    const code: ErrorCode = isChunk ? "CHUNK_LOAD" : "NETWORK";
    const entry = catalogEntry(code);
    if (throttled(lastLogAt, `res:${src}`, LOG_THROTTLE_MS)) return;
    logClientError({
      code,
      status: entry.status,
      userMessage: entry.message,
      source: "resource",
      detail: `nie załadowano <${tag}> ${scrubDetail(pathOf(src) ?? "")}`,
      click: currentClick(),
      page: window.location.pathname,
    });
    if (isChunk) maybeNotify({ code, status: 0, userMessage: entry.message, source: "resource" });
    return;
  }

  const e = event as ErrorEvent;
  if (isForeignScript(e.filename, e.error instanceof Error ? e.error.stack : null)) return;
  const reason = e.error ?? e.message;
  // „Script error.” bez szczegółów to szum z obcych skryptów — log, ale bez popupu.
  const opaque = !e.error && /^script error\.?$/i.test(e.message ?? "");
  handleClientError(reason, { source: "window-error", notify: !opaque });
}

function onUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  if (reason instanceof Error && isForeignScript(null, reason.stack)) return;
  handleClientError(reason, { source: "unhandled-rejection" });
}

/** Instaluje wszystkie globalne obserwatory. Zwraca funkcję sprzątającą. */
export function installClientErrorHandling(): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onClick = (event: MouseEvent) => {
    const desc = describeElement(event.target);
    if (desc) lastClick = { desc, at: Date.now() };
  };
  window.addEventListener("click", onClick, true);
  window.addEventListener("error", onWindowError, true);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  const restoreFetch = installFetchInterceptor();

  return () => {
    window.removeEventListener("click", onClick, true);
    window.removeEventListener("error", onWindowError, true);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    restoreFetch();
  };
}
