import { afterEach, describe, expect, it } from "vitest";
import { resolveAndroidApiBaseUrl } from "@/lib/trigger-android-apk-build";

describe("resolveAndroidApiBaseUrl", () => {
  const prev = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    AUTH_URL: process.env.AUTH_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  };

  afterEach(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("preferuje NEXT_PUBLIC_APP_URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://gymbrat.onrender.com";
    process.env.AUTH_URL = "https://example.com";
    expect(resolveAndroidApiBaseUrl()).toBe("https://gymbrat.onrender.com/");
  });

  it("bierze origin z nagłówków requestu", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    const req = new Request("http://localhost/api/admin/branding", {
      headers: {
        host: "gymbrat.onrender.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(resolveAndroidApiBaseUrl(req)).toBe("https://gymbrat.onrender.com/");
  });

  it("ma fallback Render gdy brak env", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(resolveAndroidApiBaseUrl()).toBe("https://gymbrat.onrender.com/");
  });
});
