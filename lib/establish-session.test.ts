import { afterEach, describe, expect, it } from "vitest";
import { decode, encode } from "next-auth/jwt";
import { establishCredentialsSession } from "@/lib/establish-session";

const KEYS = ["AUTH_SECRET", "NEXTAUTH_SECRET", "AUTH_URL", "NEXTAUTH_URL", "VERCEL"] as const;
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

describe("establishCredentialsSession", () => {
  rememberEnv();
  afterEach(() => restoreEnv());

  it("bez sekretu zwraca false", async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    process.env.AUTH_URL = "http://localhost:3000";
    const ok = await establishCredentialsSession({
      id: "u1",
      email: "a@b.c",
      role: "zawodnik",
    });
    expect(ok).toBe(false);
  });

  it("koduje JWT z solą równą nazwie cookie sesji Auth.js", async () => {
    const secret = "test-secret-at-least-32-chars-long!!";
    const name = "__Secure-authjs.session-token";
    const token = await encode({
      token: {
        id: "user-1",
        sub: "user-1",
        email: "test@example.com",
        role: "zawodnik",
      },
      secret,
      maxAge: 60,
      salt: name,
    });
    const payload = await decode({ token, secret, salt: name });
    expect(payload?.sub).toBe("user-1");
    expect(payload?.email).toBe("test@example.com");
    expect((payload as { role?: string } | null)?.role).toBe("zawodnik");
  });
});
