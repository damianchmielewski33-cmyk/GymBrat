import { describe, expect, it } from "vitest";
import { securityEventMeta, type SecurityEventInput } from "@/lib/security-events";

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
