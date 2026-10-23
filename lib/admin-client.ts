"use client";

import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";

export type AdminRequestResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; data: Partial<T> | null };

const STATUS_HINTS: Record<number, string> = {
  401: "Sesja wygasła — zaloguj się ponownie.",
  403: "Brak uprawnień admina lub CSRF — odśwież stronę i spróbuj ponownie.",
  413: "Dane są zbyt duże dla serwera.",
  429: "Zbyt wiele żądań — spróbuj za chwilę.",
};

/**
 * Wspólny klient API panelu admina: CSRF dla zapisów, JSON in/out i jednolite komunikaty błędów.
 * Zwraca wynik zamiast rzucać wyjątek, żeby wywołujący mógł pokazać własny komunikat.
 */
export async function adminRequest<T = Record<string, unknown>>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    body?: unknown;
    fallbackError?: string;
  } = {},
): Promise<AdminRequestResult<T>> {
  const method = options.method ?? "GET";
  const fallback = options.fallbackError ?? "Operacja nie powiodła się.";
  try {
    const headers: Record<string, string> = {};
    if (method !== "GET") {
      await ensureCsrfCookie();
      Object.assign(headers, getXsrfHeaders());
    }
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(url, {
      method,
      credentials: "include",
      cache: method === "GET" ? "no-store" : undefined,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as
      | (T & { ok?: boolean; error?: string })
      | null;

    if (!res.ok || json?.ok === false) {
      return {
        ok: false,
        status: res.status,
        error: json?.error ?? STATUS_HINTS[res.status] ?? fallback,
        data: json,
      };
    }
    return { ok: true, status: res.status, data: (json ?? {}) as T };
  } catch {
    return {
      ok: false,
      status: 0,
      error: "Brak połączenia z serwerem — sprawdź internet i spróbuj ponownie.",
      data: null,
    };
  }
}
