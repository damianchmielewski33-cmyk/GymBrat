import { describe, expect, it } from "vitest";
import { hasAuthSessionCookie } from "@/lib/auth-session-cookie";

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
