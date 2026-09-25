import { describe, expect, it } from "vitest";
import { assertAnalyticsOrigin, assertCsrf } from "@/lib/csrf";
import { CSRF_COOKIE_NAME } from "@/lib/csrf-constants";

function post(url: string, init: { origin?: string | null; cookie?: string; token?: string }) {
  const headers: Record<string, string> = {};
  if (init.origin !== undefined && init.origin !== null) {
    headers.origin = init.origin;
  }
  if (init.cookie) headers.cookie = init.cookie;
  if (init.token) headers["x-xsrf-token"] = init.token;
  return new Request(url, { method: "POST", headers });
}

describe("assertCsrf", () => {
  it("returns null for GET", () => {
    expect(assertCsrf(new Request("https://app.example.com/api/x", { method: "GET" }))).toBeNull();
  });

  it("rejects when cookie and header token mismatch", () => {
    const r = post("https://app.example.com/api/x", {
      origin: "https://app.example.com",
      cookie: `${CSRF_COOKIE_NAME}=aaa`,
      token: "bbb",
    });
    const res = assertCsrf(r);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("allows POST when origin matches request URL and tokens match", () => {
    const tok = "a".repeat(64);
    const r = post("http://localhost:3000/api/foo", {
      origin: "http://localhost:3000",
      cookie: `${CSRF_COOKIE_NAME}=${tok}`,
      token: tok,
    });
    expect(assertCsrf(r)).toBeNull();
  });
});

describe("assertAnalyticsOrigin", () => {
  it("allows same-origin POST even when env allowlist is empty", () => {
    const prev = process.env.NODE_ENV;
    const nextAuth = process.env.NEXTAUTH_URL;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const vercel = process.env.VERCEL_URL;
    const csrfExtra = process.env.CSRF_ALLOWED_ORIGINS;
    process.env.NODE_ENV = "production";
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    delete process.env.CSRF_ALLOWED_ORIGINS;
    try {
      const req = new Request("https://gym-brat.vercel.app/api/analytics/page-view", {
        method: "POST",
        headers: {
          origin: "https://gym-brat.vercel.app",
          "sec-fetch-site": "same-origin",
        },
      });
      expect(assertAnalyticsOrigin(req)).toBeNull();
    } finally {
      process.env.NODE_ENV = prev;
      if (nextAuth === undefined) delete process.env.NEXTAUTH_URL;
      else process.env.NEXTAUTH_URL = nextAuth;
      if (appUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = appUrl;
      if (vercel === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = vercel;
      if (csrfExtra === undefined) delete process.env.CSRF_ALLOWED_ORIGINS;
      else process.env.CSRF_ALLOWED_ORIGINS = csrfExtra;
    }
  });

  it("allows Origin matching Host when request URL is a different Vercel deployment host", () => {
    const req = new Request(
      "https://gym-brat-git-cursor-login-style-xxxx.vercel.app/api/analytics/page-view",
      {
        method: "POST",
        headers: {
          origin: "https://gym-brat.vercel.app",
          host: "gym-brat.vercel.app",
          "x-forwarded-host": "gym-brat.vercel.app",
          "x-forwarded-proto": "https",
          "sec-fetch-site": "same-origin",
        },
      },
    );
    expect(assertAnalyticsOrigin(req)).toBeNull();
  });

  it("allows sec-fetch-site none for same-origin WebView beacons", () => {
    const req = new Request("https://gym-brat.vercel.app/api/analytics/page-view", {
      method: "POST",
      headers: {
        origin: "https://gym-brat.vercel.app",
        "sec-fetch-site": "none",
        "user-agent":
          "Mozilla/5.0 GymBratAndroidApp/0.1.1 GymBratAndroidCode/2",
      },
    });
    expect(assertAnalyticsOrigin(req)).toBeNull();
  });

  it("rejects cross-site Origin", () => {
    const req = new Request("https://gym-brat.vercel.app/api/analytics/page-view", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      },
    });
    const res = assertAnalyticsOrigin(req);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });
});
