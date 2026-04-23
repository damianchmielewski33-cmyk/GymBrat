import { auth } from "@/auth";
import { importBodyReports } from "@/lib/body-reports";
import { parseBodyReportsFromXlsx } from "@/lib/excel/body-report-import";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertCsrf } from "@/lib/csrf";
import { checkRateLimitAsync, rateLimitKey, RATE } from "@/lib/rate-limit";
import dns from "node:dns/promises";
import net from "node:net";

export const runtime = "nodejs";

const MAX_REMOTE_BYTES = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT_MS = 12_000;

function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1") return true;
  // IPv4 ranges
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true; // link-local
  if (/^0\./.test(ip)) return true;
  // IPv6 ranges (basic block list)
  if (/^fc/i.test(ip) || /^fd/i.test(ip)) return true; // unique local (fc00::/7)
  if (/^fe8/i.test(ip) || /^fe9/i.test(ip) || /^fea/i.test(ip) || /^feb/i.test(ip))
    return true; // link-local fe80::/10 (rough)
  return false;
}

async function assertRemoteUrlSafe(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Nieprawidłowy URL.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("URL musi używać http(s).");
  }
  if (!u.hostname) throw new Error("Brak hosta w URL.");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Niedozwolony host.");
  }

  const ipDirect = net.isIP(host) ? host : null;
  if (ipDirect && isPrivateIp(ipDirect)) {
    throw new Error("Niedozwolony adres docelowy.");
  }

  if (!ipDirect) {
    const addrs = await dns.lookup(host, { all: true, verbatim: true });
    if (addrs.length === 0) throw new Error("Nie udało się rozwiązać hosta.");
    if (addrs.some((a) => isPrivateIp(a.address))) {
      throw new Error("Niedozwolony adres docelowy.");
    }
  }
  return u;
}

async function readBufferFromUrl(url: URL): Promise<ArrayBuffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "error",
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
    if (!res.ok) {
      throw new Error(`Nie udało się pobrać pliku (HTTP ${res.status}).`);
    }
    const lenRaw = res.headers.get("content-length");
    if (lenRaw) {
      const n = Number(lenRaw);
      if (Number.isFinite(n) && n > MAX_REMOTE_BYTES) {
        throw new Error("Plik jest za duży.");
      }
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_REMOTE_BYTES) {
      throw new Error("Plik jest za duży.");
    }
    return buf;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Timeout pobierania pliku.");
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  const csrf = assertCsrf(req);
  if (csrf) return csrf;

  const rl = await checkRateLimitAsync(
    rateLimitKey("body-report-import", req),
    RATE.bodyReportImport.limit,
    RATE.bodyReportImport.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limit" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nieprawidłowe dane formularza" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const url = String(form.get("url") ?? "").trim();

  let buf: ArrayBuffer | null = null;
  if (file instanceof File) {
    buf = await file.arrayBuffer();
  } else if (url) {
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Link musi zaczynać się od http(s). Ścieżka lokalna typu C:\\... nie zadziała w przeglądarce — użyj uploadu pliku.",
        },
        { status: 400 },
      );
    }
    try {
      const safeUrl = await assertRemoteUrlSafe(url);
      buf = await readBufferFromUrl(safeUrl);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Nie udało się pobrać pliku." },
        { status: 400 },
      );
    }
  }

  if (!buf) {
    return NextResponse.json(
      { ok: false, error: "Dodaj plik .xlsx albo podaj link do pliku." },
      { status: 400 },
    );
  }

  let parsed: ReturnType<typeof parseBodyReportsFromXlsx>;
  try {
    parsed = parseBodyReportsFromXlsx(buf);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Nie udało się odczytać pliku Excel." },
      { status: 400 },
    );
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nie znaleziono wierszy do importu w arkuszu `Raport`.", warnings: parsed.warnings },
      { status: 400 },
    );
  }

  const { imported, skipped } = await importBodyReports(session.user.id, parsed.rows);
  revalidatePath("/reports");
  return NextResponse.json({ ok: true, imported, skipped, warnings: parsed.warnings });
}

