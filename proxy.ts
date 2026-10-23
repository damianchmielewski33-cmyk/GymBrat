import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken, type JWT } from "next-auth/jwt";
import { getAccountAuthState, isTokenRevoked } from "@/lib/account-auth-state";
import { SESSION_EXPIRED_PARAM } from "@/lib/auth-error-codes";
import { getAuthSecret } from "@/lib/auth-secret";
import { isAuthSessionCookieName } from "@/lib/auth-session-cookie";
import { errorResponse } from "@/lib/errors/api";
import { AppError } from "@/lib/errors/app-error";
import { logServerError, requestIdFrom } from "@/lib/errors/server-log";
import {
  isAnonymousPublicPath,
  isCompleteProfilePath,
  mustCompleteProfile,
  postAuthDestination,
  shouldBounceAuthenticatedFromAuthPage,
} from "@/lib/auth-public-paths";

/** Musi być zgodne z Auth.js: na HTTPS sesja jest w `__Secure-authjs.session-token`, nie w `authjs.session-token`. */
function isSecureSessionCookie(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded === "https") return true;
  if (forwarded === "http") return false;
  return req.nextUrl.protocol === "https:";
}

async function readSessionToken(req: NextRequest) {
  const secret = getAuthSecret();
  if (!secret) return null;
  const secure = isSecureSessionCookie(req);
  try {
    const primary = await getToken({
      req,
      secret,
      secureCookie: secure,
    });
    if (primary) return primary;
    // Fallback: iOS / proxy czasem mylą http vs https → druga nazwa ciasteczka.
    return await getToken({
      req,
      secret,
      secureCookie: !secure,
    });
  } catch {
    /** Uszkodzone ciasteczko nie może wywalić WebView jako 500 / popup błędu. */
    return null;
  }
}

/** Sesja unieważniona (ADR 0001 D5): konto usunięte/przejęte albo inna wersja sesji. */
async function isSessionRevoked(token: JWT): Promise<boolean> {
  const uid =
    typeof token.id === "string" ? token.id : typeof token.sub === "string" ? token.sub : "";
  try {
    return isTokenRevoked({ id: uid, sv: token.sv }, await getAccountAuthState(uid));
  } catch {
    /** Chwilowy błąd bazy nie wylogowuje — `jwt` i kolejne żądania sprawdzą ponownie. */
    return false;
  }
}

/**
 * Czyści ciasteczka sesji i kieruje na `/login?session=expired`; bez tego strona (brak sesji)
 * i proxy (ciasteczko jest) odbijałyby się nawzajem.
 */
function revokedSessionResponse(req: NextRequest, pathname: string): NextResponse {
  const onExpiredLogin =
    pathname === "/login" && req.nextUrl.searchParams.get("session") === SESSION_EXPIRED_PARAM;
  let res: NextResponse;
  if (pathname.startsWith("/api/")) {
    const api = errorResponse("UNAUTHORIZED", { requestId: requestIdFrom(req.headers) });
    res = new NextResponse(api.body, { status: api.status, headers: api.headers });
  } else if (onExpiredLogin) {
    res = NextResponse.next();
  } else {
    res = NextResponse.redirect(new URL(`/login?session=${SESSION_EXPIRED_PARAM}`, req.url));
  }
  for (const cookie of req.cookies.getAll()) {
    if (isAuthSessionCookieName(cookie.name)) res.cookies.delete(cookie.name);
  }
  return res;
}

/** Ochrona tras (Next.js 16 — eksport musi nazywać się `proxy`). */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  /** Anonimowe zliczanie wejść — bez JWT (por. tracker klienta). */
  if (pathname.startsWith("/api/analytics/")) {
    return NextResponse.next();
  }

  /**
   * Aktualizacje APK: natywna aplikacja Android nie ma sesji NextAuth.
   * Bez tego GET /api/android/version i /gymbrat.apk lądują na HTML logowania.
   */
  if (
    pathname.startsWith("/api/android/") ||
    pathname === "/android-version.json" ||
    pathname.endsWith(".apk")
  ) {
    return NextResponse.next();
  }

  /**
   * Crony (Vercel Cron, GitHub Actions, systemd) nie mają sesji NextAuth — każda trasa
   * w /api/cron/ sama sprawdza `CRON_SECRET`. Bez tego wywołania kończyły się 401.
   */
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  /** Branding / PWA ikony — publiczne (login, favicon, WebView bez sesji). */
  if (pathname.startsWith("/api/branding")) {
    return NextResponse.next();
  }

  /**
   * Digital Asset Links / App Links — GoogleAssociationService musi dostać 200 JSON,
   * nie 307 na /login.
   */
  if (pathname.startsWith("/.well-known/")) {
    return NextResponse.next();
  }

  /** Publiczny provenance wdrożenia — wyłącznie z repozytorium GymBrat. */
  if (pathname === "/api/version") {
    return NextResponse.next();
  }

  /** Trwałe grafiki katalogu (wygenerowane przy imporcie) — publiczne dla <img>. */
  if (pathname.startsWith("/api/catalog-meal-image/")) {
    return NextResponse.next();
  }

  /** Token CSRF (double-submit) — publiczny GET, bez sesji. */
  if (pathname === "/api/csrf") {
    return NextResponse.next();
  }

  /** CSP raporty (Report-Only) — publiczny POST z przeglądarki. */
  if (pathname === "/api/security/csp-report") {
    return NextResponse.next();
  }

  /** Błędy z przeglądarki → logi serwera; błąd może wystąpić też na /login (bez sesji). */
  if (pathname === "/api/client-errors") {
    return NextResponse.next();
  }

  const token = await readSessionToken(req);
  if (token && (await isSessionRevoked(token))) {
    return revokedSessionResponse(req, pathname);
  }
  const profileComplete = token?.profileComplete === true;
  const oauthExisting = req.nextUrl.searchParams.get("oauth") === "existing";
  const sessionExpired = req.nextUrl.searchParams.get("session") === SESSION_EXPIRED_PARAM;
  const oauthRegisterContinue =
    pathname === "/register" &&
    req.nextUrl.searchParams.get("oauth") === "1";

  if (isAnonymousPublicPath(pathname)) {
    // /login?oauth=existing i ?session=expired — komunikat na ekranie logowania, bez odbicia na Pulpit.
    if (token && pathname === "/login" && (oauthExisting || sessionExpired)) {
      return NextResponse.next();
    }
    if (token && shouldBounceAuthenticatedFromAuthPage(pathname, profileComplete)) {
      // Rejestracja Google przy już kompletnym koncie → nie ciche logowanie na Pulpit.
      if (oauthRegisterContinue && profileComplete) {
        return NextResponse.redirect(new URL("/login?oauth=existing", req.url));
      }
      return NextResponse.redirect(
        new URL(postAuthDestination(profileComplete), req.url),
      );
    }
    // Start (/) z sesją, ale bez parametrów ciała (np. po Google) → formularz.
    if (token && pathname === "/" && mustCompleteProfile(pathname, profileComplete)) {
      return NextResponse.redirect(new URL(postAuthDestination(false), req.url));
    }
    return NextResponse.next();
  }

  if (!token && pathname.startsWith("/api/")) {
    /** API nie przekierowuje na HTML logowania — klient dostaje czytelne 401 JSON. */
    const requestId = requestIdFrom(req.headers);
    logServerError(
      new AppError("UNAUTHORIZED"),
      { requestId, method: req.method, path: pathname, routeType: "proxy" },
    );
    return errorResponse("UNAUTHORIZED", { requestId });
  }

  if (!token) {
    const login = new URL("/login", req.url);
    const dest = `${pathname}${req.nextUrl.search}`;
    login.searchParams.set("callbackUrl", dest);
    const from = req.nextUrl.searchParams.get("from");
    if (from) login.searchParams.set("from", from);
    return NextResponse.redirect(login);
  }

  if (mustCompleteProfile(pathname, profileComplete)) {
    return NextResponse.redirect(new URL(postAuthDestination(false), req.url));
  }

  if (profileComplete && isCompleteProfilePath(pathname)) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/android|_next/static|_next/image|favicon.ico|manifest.webmanifest|android-version.json|sw.js|push-sw.js|workbox.*|\\.well-known/.*|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk)$).*)",
  ],
};
