/**
 * Most BFF Next.js → Java (Spring Boot).
 * Gdy `JAVA_API_BASE_URL` jest ustawione, publiczne i domenowe API idą do backendu Java.
 * Bez zmiennej zachowanie legacy (logika w Next / Drizzle) pozostaje aktywne.
 */

export function javaApiBaseUrl(): string | null {
  const raw = process.env.JAVA_API_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

export function isJavaApiEnabled(): boolean {
  return javaApiBaseUrl() != null;
}

export function javaProxyToken(): string | null {
  const t = process.env.GYMBRAT_PROXY_TOKEN?.trim();
  return t || null;
}

export type JavaProxyInit = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  /** ID użytkownika sesji NextAuth — wymagane dla chronionych endpointów Java. */
  userId?: string | null;
  cache?: RequestCache;
  signal?: AbortSignal;
};

/**
 * Wywołanie HTTP do Spring Boot. Zwraca Response (do przekazania dalej)
 * albo null, gdy Java API nie jest skonfigurowane.
 */
export async function fetchJavaApi(
  path: string,
  init: JavaProxyInit = {},
): Promise<Response | null> {
  const base = javaApiBaseUrl();
  if (!base) return null;

  const urlPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (init.userId) {
    headers.set("X-GymBrat-User-Id", init.userId);
  }
  const token = javaProxyToken();
  if (token) {
    headers.set("X-GymBrat-Proxy-Token", token);
  }

  return fetch(`${base}${urlPath}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body,
    cache: init.cache ?? "no-store",
    signal: init.signal ?? AbortSignal.timeout(15_000),
    redirect: "manual",
  });
}

/** Przekazuje odpowiedź Java (w tym redirect 302) jako Next Response-compatible. */
export async function passThroughJavaResponse(
  javaRes: Response,
): Promise<Response> {
  const headers = new Headers();
  javaRes.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "transfer-encoding" || lower === "connection") return;
    headers.set(key, value);
  });

  if (javaRes.status >= 300 && javaRes.status < 400) {
    const location = javaRes.headers.get("Location");
    if (location) {
      return Response.redirect(location, javaRes.status as 301 | 302 | 303 | 307 | 308);
    }
  }

  const buf = await javaRes.arrayBuffer();
  return new Response(buf, { status: javaRes.status, headers });
}
