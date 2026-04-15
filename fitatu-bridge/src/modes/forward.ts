import {
  extractUpstreamAuthToken,
  normalizeDiaryResponse,
} from "../normalize-diary.js";

function extraHeaders(): Record<string, string> {
  const raw = process.env.FITATU_UPSTREAM_EXTRA_HEADERS_JSON?.trim();
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function headersForJsonPost(): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...extraHeaders(),
  };
}

function headersForGet(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json", ...extraHeaders() };
  delete h["content-type"];
  delete h["Content-Type"];
  return h;
}

export async function forwardLogin(email: string, password: string) {
  const url = process.env.FITATU_UPSTREAM_LOGIN_URL?.trim();
  if (!url) {
    throw new Error(
      "Brak FITATU_UPSTREAM_LOGIN_URL — ustaw adres logowania z przechwyconego ruchu aplikacji Fitatu.",
    );
  }

  const res = await fetch(url, {
    method: "POST",
    headers: headersForJsonPost(),
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Upstream login zwrócił nie-JSON.");
  }

  if (!res.ok) {
    const msg =
      typeof body === "object" &&
      body &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
        ? (body as { message: string }).message
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  const token = extractUpstreamAuthToken(body);
  if (!token) {
    throw new Error(
      "Nie znaleziono tokena w odpowiedzi logowania — dopasuj upstream lub rozszerz extractUpstreamAuthToken w normalize-diary.ts.",
    );
  }

  return { upstreamToken: token };
}

export async function forwardDiary(date: string, upstreamToken: string) {
  const tpl = process.env.FITATU_UPSTREAM_DIARY_URL_TEMPLATE?.trim();
  if (!tpl) {
    throw new Error("Brak FITATU_UPSTREAM_DIARY_URL_TEMPLATE (użyj {{date}}).");
  }
  const url = tpl.replaceAll("{{date}}", date);

  const authHeader = process.env.FITATU_UPSTREAM_DIARY_AUTH_HEADER?.trim() || "Authorization";
  const authPrefix = process.env.FITATU_UPSTREAM_DIARY_AUTH_PREFIX?.trim() ?? "Bearer ";

  const headers = new Headers(headersForGet());
  headers.set(authHeader, `${authPrefix}${upstreamToken}`.trim());

  const res = await fetch(url, { method: "GET", headers });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Upstream diary zwrócił nie-JSON.");
  }
  if (!res.ok) {
    throw new Error(`Diary HTTP ${res.status}`);
  }

  return normalizeDiaryResponse(body, date);
}
