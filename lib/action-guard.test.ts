import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ip: "203.0.113.7",
  session: "token-A" as string | null,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": state.ip }),
  cookies: async () => ({
    getAll: () =>
      state.session ? [{ name: "authjs.session-token", value: state.session }] : [],
  }),
}));

import { guardAction } from "@/lib/action-guard";
import { AppError, parseAppErrorDigest } from "@/lib/errors/app-error";

describe("guardAction", () => {
  beforeEach(() => {
    state.ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    state.session = `token-${Math.random()}`;
  });

  it("przepuszcza ruch w ramach limitu", async () => {
    await expect(guardAction("test.ok", { limit: 3, windowMs: 60_000 })).resolves.toBeUndefined();
  });

  it("rzuca AppError RATE_LIMITED po przekroczeniu limitu akcji", async () => {
    const limit = { limit: 2, windowMs: 60_000 };
    await guardAction("test.strict", limit);
    await guardAction("test.strict", limit);
    const err = await guardAction("test.strict", limit).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("RATE_LIMITED");
    expect((err as AppError).status).toBe(429);
  });

  it("kod błędu jest dostępny w digeście dla klienta", async () => {
    const limit = { limit: 1, windowMs: 60_000 };
    await guardAction("test.digest", limit);
    const err = (await guardAction("test.digest", limit).catch((e: unknown) => e)) as AppError;
    expect(parseAppErrorDigest(err.digest)?.code).toBe("RATE_LIMITED");
  });

  it("limity są liczone osobno dla różnych sesji", async () => {
    const limit = { limit: 1, windowMs: 60_000 };
    state.session = "user-one";
    state.ip = "198.51.100.201";
    await guardAction("test.sessions", limit);
    state.session = "user-two";
    await expect(guardAction("test.sessions", limit)).resolves.toBeUndefined();
  });
});

describe("parseAppErrorDigest", () => {
  it("ignoruje obce digesty", () => {
    expect(parseAppErrorDigest("123456")).toBeNull();
    expect(parseAppErrorDigest("GB-NOT_A_CODE-abc")).toBeNull();
    expect(parseAppErrorDigest(undefined)).toBeNull();
  });
});
