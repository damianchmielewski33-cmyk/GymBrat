import { describe, expect, it } from "vitest";
import {
  assertAnalyticsOrigin,
  assertCsrf,
  GYMBRAT_PRODUCTION_ORIGIN,
} from "@/lib/csrf";
import { CSRF_COOKIE_NAME } from "@/lib/csrf-constants";

function post(
  url: string,
  init: {
    origin?: string | null;
    cookie?: string;
    token?: string;
    secFetchSite?: string;
  },
) {
  const headers: Record<string, string> = {};
  if (init.origin !== undefined && init.origin !== null) {
    headers.origin = init.origin;
  }
  if (init.cookie) headers.cookie = init.cookie;
  if (init.token) headers["x-xsrf-token"] = init.token;
  if (init.secFetchSite) headers["sec-fetch-site"] = init.secFetchSite;
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
  it("allows same-origin production GymBrat (Origin header)", () => {
    const r = post(`${GYMBRAT_PRODUCTION_ORIGIN}/api/analytics/page-view`, {
      origin: GYMBRAT_PRODUCTION_ORIGIN,
      secFetchSite: "same-origin",
    });
    expect(assertAnalyticsOrigin(r)).toBeNull();
  });

  it("allows AWP origin for analytics", () => {
    const r = post(`${GYMBRAT_PRODUCTION_ORIGIN}/api/analytics/page-view`, {
      origin: "https://akademia-wielkich-pilkarzy.vercel.app",
      secFetchSite: "cross-site",
    });
    expect(assertAnalyticsOrigin(r)).toBeNull();
  });

  it("soft-rejects unknown origin with 204 (not 403)", async () => {
    const r = post(`${GYMBRAT_PRODUCTION_ORIGIN}/api/analytics/page-view`, {
      origin: "https://evil.example",
      secFetchSite: "cross-site",
    });
    const res = assertAnalyticsOrigin(r);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(204);
    expect(await res!.text()).toBe("");
  });

  it("allows missing Origin (beacon / some WebViews)", () => {
    const r = post(`${GYMBRAT_PRODUCTION_ORIGIN}/api/analytics/page-view`, {});
    expect(assertAnalyticsOrigin(r)).toBeNull();
  });
});
