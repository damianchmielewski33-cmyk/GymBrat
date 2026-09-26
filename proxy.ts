import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/auth-secret";
import {
  isAnonymousPublicPath,
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
  try {
    return await getToken({
      req,
      secret,
      secureCookie: isSecureSessionCookie(req),
    });
  } catch {
    /** Uszkodzone ciasteczko nie może wywalić WebView jako 500 / popup błędu. */
    return null;
  }
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

  /** Token CSRF (double-submit) — publiczny GET, bez sesji. */
  if (pathname === "/api/csrf") {
    return NextResponse.next();
  }

  /** CSP raporty (Report-Only) — publiczny POST z przeglądarki. */
  if (pathname === "/api/security/csp-report") {
    return NextResponse.next();
  }

  /** Changelog dostępny bez logowania (sesja opcjonalna). */
  if (pathname === "/changelog") {
    return NextResponse.next();
  }

  const token = await readSessionToken(req);

  if (isAnonymousPublicPath(pathname)) {
    if (token && shouldBounceAuthenticatedFromAuthPage(pathname)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const login = new URL("/login", req.url);
    const dest = `${pathname}${req.nextUrl.search}`;
    login.searchParams.set("callbackUrl", dest);
    const from = req.nextUrl.searchParams.get("from");
    if (from) login.searchParams.set("from", from);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|api/android|_next/static|_next/image|favicon.ico|manifest.webmanifest|android-version.json|sw.js|workbox.*|\\.well-known/.*|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|apk)$).*)",
  ],
};
