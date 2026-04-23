import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "@/lib/auth-secret";

/** Musi być zgodne z Auth.js: na HTTPS sesja jest w `__Secure-authjs.session-token`, nie w `authjs.session-token`. */
function isSecureSessionCookie(req: NextRequest): boolean {
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded === "https") return true;
  if (forwarded === "http") return false;
  return req.nextUrl.protocol === "https:";
}

/** Ochrona tras (Next.js 16 — eksport musi nazywać się `proxy`). */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  /** Anonimowe zliczanie wejść — bez JWT (por. tracker klienta). */
  if (pathname.startsWith("/api/analytics/")) {
    return NextResponse.next();
  }

  /** Token CSRF (double-submit) — publiczny GET, bez sesji. */
  if (pathname === "/api/csrf") {
    return NextResponse.next();
  }

  const publicPaths = new Set(["/login", "/register"]);

  const secret = getAuthSecret();
  const secureCookie = isSecureSessionCookie(req);

  const token =
    secret &&
    (await getToken({
      req,
      secret,
      secureCookie,
    }));

  if (publicPaths.has(pathname)) {
    if (token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox.*|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
