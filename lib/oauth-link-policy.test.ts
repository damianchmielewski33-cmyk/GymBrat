import { describe, expect, it } from "vitest";
import { decideOAuthSignIn, type OAuthDecisionInput } from "@/lib/oauth-link-policy";

const base: OAuthDecisionInput = {
  provider: "google",
  email: "a@x.pl",
  providerEmailVerified: true,
  linkedUserId: null,
  accountByEmail: null,
};

const verified = { id: "u-ver", emailVerified: true, isAdmin: false };
const unverified = { id: "u-unv", emailVerified: false, isAdmin: false };
const unverifiedAdmin = { id: "u-adm", emailVerified: false, isAdmin: true };

describe("decideOAuthSignIn", () => {
  it("istniejące powiązanie zawsze = login_linked (także przy innym koncie o tym e-mailu)", () => {
    for (const provider of ["google", "facebook"] as const) {
      expect(
        decideOAuthSignIn({
          ...base,
          provider,
          providerEmailVerified: false,
          linkedUserId: "u-linked",
          accountByEmail: verified,
        }),
      ).toEqual({ kind: "login_linked", userId: "u-linked" });
    }
    expect(decideOAuthSignIn({ ...base, email: "", linkedUserId: "u-linked" })).toEqual({
      kind: "login_linked",
      userId: "u-linked",
    });
  });

  it("brak e-maila = OAuthNoEmail", () => {
    expect(decideOAuthSignIn({ ...base, email: "" })).toEqual({
      kind: "reject",
      code: "OAuthNoEmail",
    });
    expect(decideOAuthSignIn({ ...base, provider: "facebook", email: "" })).toEqual({
      kind: "reject",
      code: "OAuthNoEmail",
    });
  });

  it("Google bez potwierdzenia = OAuthEmailUnverified niezależnie od konta", () => {
    for (const accountByEmail of [null, verified, unverified, unverifiedAdmin]) {
      expect(
        decideOAuthSignIn({ ...base, providerEmailVerified: false, accountByEmail }),
      ).toEqual({ kind: "reject", code: "OAuthEmailUnverified" });
    }
  });

  it("Google potwierdzony, brak konta = create zweryfikowane", () => {
    expect(decideOAuthSignIn(base)).toEqual({ kind: "create", emailVerified: true });
  });

  it("Google potwierdzony, konto zweryfikowane = link_existing", () => {
    expect(decideOAuthSignIn({ ...base, accountByEmail: verified })).toEqual({
      kind: "link_existing",
      userId: "u-ver",
    });
  });

  it("Google potwierdzony, konto niezweryfikowane admin = OAuthLinkRefused", () => {
    expect(decideOAuthSignIn({ ...base, accountByEmail: unverifiedAdmin })).toEqual({
      kind: "reject",
      code: "OAuthLinkRefused",
    });
  });

  it("Google potwierdzony, konto niezweryfikowane = takeover_confirm", () => {
    expect(decideOAuthSignIn({ ...base, accountByEmail: unverified })).toEqual({
      kind: "takeover_confirm",
      userId: "u-unv",
    });
  });

  it("Facebook nigdy nie łączy: konto istnieje = OAuthLinkRefused (także zweryfikowane)", () => {
    for (const accountByEmail of [verified, unverified, unverifiedAdmin]) {
      expect(
        decideOAuthSignIn({ ...base, provider: "facebook", accountByEmail }),
      ).toEqual({ kind: "reject", code: "OAuthLinkRefused" });
    }
  });

  it("Facebook bez konta = create niezweryfikowane (nawet gdy profil twierdzi, że potwierdzony)", () => {
    expect(
      decideOAuthSignIn({ ...base, provider: "facebook", providerEmailVerified: true }),
    ).toEqual({ kind: "create", emailVerified: false });
  });
});
