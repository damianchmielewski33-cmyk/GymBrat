import { afterEach, describe, expect, it } from "vitest";
import {
  appEmbedCookieOptions,
  authCookiesForEmbed,
  useSecureAuthCookies,
} from "@/lib/auth-cookies";

const KEYS = ["AUTH_URL", "NEXTAUTH_URL", "VERCEL"] as const;

const snapshot: Record<string, string | undefined> = {};

function rememberEnv() {
  for (const k of KEYS) snapshot[k] = process.env[k];
}

function restoreEnv() {
  for (const k of KEYS) {
    const v = snapshot[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("auth-cookies", () => {
  rememberEnv();
  afterEach(() => restoreEnv());

  it("na HTTP localhost nie włącza CHIPS", () => {
    process.env.AUTH_URL = "http://localhost:3000";
    delete process.env.VERCEL;
    expect(useSecureAuthCookies()).toBe(false);
    expect(authCookiesForEmbed()).toBeUndefined();
    expect(appEmbedCookieOptions(false).sameSite).toBe("lax");
  });

  it("na HTTPS ustawia Partitioned + SameSite=none bez prefiksu __Host-", () => {
    process.env.AUTH_URL = "https://gym-brat.vercel.app";
    const cookies = authCookiesForEmbed();
    expect(useSecureAuthCookies()).toBe(true);
    expect(cookies?.sessionToken?.name).toBe("__Secure-authjs.session-token");
    expect(cookies?.csrfToken?.name).toBe("__Secure-authjs.csrf-token");
    expect(cookies?.csrfToken?.name?.startsWith("__Host-")).toBe(false);
    expect(cookies?.sessionToken?.options?.sameSite).toBe("none");
    expect(cookies?.sessionToken?.options?.partitioned).toBe(true);
    expect(cookies?.sessionToken?.options?.secure).toBe(true);
    expect(appEmbedCookieOptions(false)).toMatchObject({
      sameSite: "none",
      secure: true,
      partitioned: true,
      httpOnly: false,
    });
  });
});
