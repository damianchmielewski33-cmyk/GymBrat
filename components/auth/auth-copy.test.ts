import { describe, expect, it } from "vitest";
import { OAUTH_ERROR_CODES } from "@/lib/auth-error-codes";
import { oauthErrorMessage, registerWelcomeCopy } from "./auth-copy";

describe("oauthErrorMessage", () => {
  it("zwraca null bez kodu", () => {
    expect(oauthErrorMessage(null)).toBeNull();
    expect(oauthErrorMessage("")).toBeNull();
  });

  it("ma osobny komunikat dla każdej odmowy z ADR 0001", () => {
    const messages = OAUTH_ERROR_CODES.map((code) => oauthErrorMessage(code));
    expect(new Set(messages).size).toBe(OAUTH_ERROR_CODES.length);
    expect(messages).not.toContain(oauthErrorMessage("nieznany-kod"));
  });

  it("nie ujawnia stanu konta (LR-29)", () => {
    for (const code of [...OAUTH_ERROR_CODES, "AccessDenied", "Configuration", "x"]) {
      const text = oauthErrorMessage(code) ?? "";
      expect(text).not.toMatch(/konto istnieje|ma już konto|nie istnieje/i);
    }
  });

  it("nie obiecuje już łączenia kont dla OAuthAccountNotLinked", () => {
    expect(oauthErrorMessage("OAuthAccountNotLinked")).not.toMatch(/połączą/);
  });

  it("anulowanie u dostawcy ma wspólny komunikat", () => {
    const text = oauthErrorMessage("AccessDenied");
    expect(oauthErrorMessage("OAuthCallback")).toBe(text);
    expect(oauthErrorMessage("OAuthSignin")).toBe(text);
  });
});

describe("registerWelcomeCopy", () => {
  it("1A: wszystkie metody", () => {
    expect(registerWelcomeCopy({ email: true, google: true, facebook: true })).toEqual({
      kind: "open",
      support: "Wybierz sposób rejestracji: Google, e-mail albo Facebook.",
      emailUnavailableProvider: null,
    });
  });

  it("1A: wymienia tylko skonfigurowane metody", () => {
    expect(
      registerWelcomeCopy({ email: true, google: true, facebook: false }).support,
    ).toBe("Wybierz sposób rejestracji: Google albo e-mail.");
    expect(
      registerWelcomeCopy({ email: true, google: false, facebook: false }).support,
    ).toBe("Załóż konto przez e-mail.");
  });

  it("1B: e-mail niedostępny, Google działa", () => {
    expect(registerWelcomeCopy({ email: false, google: true, facebook: true })).toEqual({
      kind: "open",
      support: "Najszybciej założysz konto przez Google.",
      emailUnavailableProvider: "Google",
    });
  });

  it("1C: e-mail niedostępny, tylko Facebook", () => {
    expect(registerWelcomeCopy({ email: false, google: false, facebook: true })).toEqual({
      kind: "open",
      support: "Załóż konto przez Facebook.",
      emailUnavailableProvider: "Facebook",
    });
  });

  it("1D: żadna metoda niedostępna", () => {
    expect(registerWelcomeCopy({ email: false, google: false, facebook: false })).toEqual({
      kind: "closed",
      headline: "Rejestracja jest chwilowo niedostępna",
      support: "Pracujemy nad tym. Spróbuj ponownie później.",
    });
  });
});
