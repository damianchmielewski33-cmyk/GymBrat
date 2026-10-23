import { describe, expect, it } from "vitest";
import { hasAuthSessionCookie, isAuthSessionCookieName } from "@/lib/auth-session-cookie";

describe("hasAuthSessionCookie", () => {
  it("wykrywa Auth.js i legacy NextAuth (secure / plain)", () => {
    expect(hasAuthSessionCookie((n) => n === "authjs.session-token")).toBe(true);
    expect(
      hasAuthSessionCookie((n) => n === "__Secure-authjs.session-token"),
    ).toBe(true);
    expect(
      hasAuthSessionCookie((n) => n === "next-auth.session-token"),
    ).toBe(true);
    expect(
      hasAuthSessionCookie((n) => n === "__Secure-next-auth.session-token"),
    ).toBe(true);
  });

  it("zwraca false bez ciasteczka sesji", () => {
    expect(hasAuthSessionCookie(() => false)).toBe(false);
    expect(hasAuthSessionCookie((n) => n === "csrf")).toBe(false);
  });
});

describe("isAuthSessionCookieName", () => {
  it("rozpoznaje ciasteczko sesji i jego porcje", () => {
    expect(isAuthSessionCookieName("authjs.session-token")).toBe(true);
    expect(isAuthSessionCookieName("__Secure-authjs.session-token.0")).toBe(true);
    expect(isAuthSessionCookieName("authjs.csrf-token")).toBe(false);
    expect(isAuthSessionCookieName("authjs.session-tokenx")).toBe(false);
  });
});
