import { describe, expect, it, vi } from "vitest";

const logServerError = vi.fn();
vi.mock("@/lib/errors/server-log", async (orig) => ({
  ...(await orig<typeof import("@/lib/errors/server-log")>()),
  logServerError,
}));

const {
  AUTH_FAILURE_THROTTLE_MS,
  logAuthFailure,
  securityEventMeta,
  securityEventRow,
} = await import("@/lib/security-events");
type SecurityEventInput = import("@/lib/security-events").SecurityEventInput;

describe("securityEventMeta", () => {
  it("przepuszcza tylko reason i provider", () => {
    expect(
      securityEventMeta({
        type: "oauth_link_rejected",
        userId: "u1",
        reason: "OAuthLinkRefused",
        provider: "facebook",
      }),
    ).toEqual({ reason: "OAuthLinkRefused", provider: "facebook" });
  });

  it("e-mail, kod czy waga podane przypadkiem nie trafiają do zapisu", () => {
    const input = {
      type: "register",
      userId: "u1",
      reason: "email_code",
      email: "ktos@example.com",
      code: "123456",
      weightKg: 80,
    } as unknown as SecurityEventInput;
    const meta = securityEventMeta(input);
    expect(meta).toEqual({ reason: "email_code" });
    expect(JSON.stringify(meta)).not.toContain("@");
  });

  it("bez powodu i dostawcy meta jest puste", () => {
    expect(securityEventMeta({ type: "account_takeover", userId: "u1" })).toEqual({});
  });
});

describe("securityEventRow", () => {
  it("akcja security.<typ>, actor = target, meta tylko z dozwolonych kluczy", () => {
    const row = securityEventRow({
      type: "account_takeover",
      userId: "u1",
      reason: "email_unverified",
      provider: "google",
    });
    expect(row).toMatchObject({
      actorUserId: "u1",
      targetUserId: "u1",
      action: "security.account_takeover",
      metaJson: JSON.stringify({ reason: "email_unverified", provider: "google" }),
    });
  });
});

describe("logAuthFailure", () => {
  it("loguje tylko miejsce i typ błędu, bez treści wyjątku", () => {
    logServerError.mockClear();
    logAuthFailure("test.plain", new Error("SELECT ... ktos@example.com"));
    expect(logServerError).toHaveBeenCalledTimes(1);
    const [error] = logServerError.mock.calls[0] as unknown as [Error];
    expect(error.message).toBe("test.plain: Error");
  });

  it("z throttle: najwyżej jeden wpis na miejsce na 60 s", () => {
    logServerError.mockClear();
    const t0 = 1_800_000_000_000;
    const err = new Error("db down");
    logAuthFailure("test.throttled", err, { throttle: true, now: t0 });
    logAuthFailure("test.throttled", err, { throttle: true, now: t0 + 1 });
    logAuthFailure("test.throttled", err, {
      throttle: true,
      now: t0 + AUTH_FAILURE_THROTTLE_MS - 1,
    });
    expect(logServerError).toHaveBeenCalledTimes(1);

    logAuthFailure("test.other", err, { throttle: true, now: t0 + 1 });
    expect(logServerError).toHaveBeenCalledTimes(2);

    logAuthFailure("test.throttled", err, { throttle: true, now: t0 + AUTH_FAILURE_THROTTLE_MS });
    expect(logServerError).toHaveBeenCalledTimes(3);
  });

  it("bez throttle każdy błąd jest logowany", () => {
    logServerError.mockClear();
    logAuthFailure("test.each", new Error("x"));
    logAuthFailure("test.each", new Error("x"));
    expect(logServerError).toHaveBeenCalledTimes(2);
  });
});
