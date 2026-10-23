import { describe, expect, it } from "vitest";
import {
  getRegisterEmailMode,
  getRegistrationAvailability,
} from "@/lib/register-email-mode";

const SMTP = { SMTP_HOST: "smtp.example.com", SMTP_USER: "u", SMTP_PASS: "p" };
const GOOGLE = { AUTH_GOOGLE_ID: "id", AUTH_GOOGLE_SECRET: "secret" };
const FACEBOOK = { AUTH_FACEBOOK_ID: "id", AUTH_FACEBOOK_SECRET: "secret" };

function env(vars: Record<string, string>): NodeJS.ProcessEnv {
  return vars as NodeJS.ProcessEnv;
}

describe("getRegisterEmailMode", () => {
  it("production z SMTP = smtp", () => {
    expect(getRegisterEmailMode(env({ NODE_ENV: "production", ...SMTP }))).toBe("smtp");
  });

  it("production bez SMTP = disabled (także z MOCK_REGISTER_EMAIL_CODE=1)", () => {
    expect(getRegisterEmailMode(env({ NODE_ENV: "production" }))).toBe("disabled");
    expect(
      getRegisterEmailMode(env({ NODE_ENV: "production", MOCK_REGISTER_EMAIL_CODE: "1" })),
    ).toBe("disabled");
  });

  it("development i test bez SMTP = test", () => {
    expect(getRegisterEmailMode(env({ NODE_ENV: "development" }))).toBe("test");
    expect(getRegisterEmailMode(env({ NODE_ENV: "test" }))).toBe("test");
  });

  it("development z SMTP = smtp", () => {
    expect(getRegisterEmailMode(env({ NODE_ENV: "development", ...SMTP }))).toBe("smtp");
  });

  it("development na hostingu (RENDER/VERCEL) = disabled", () => {
    expect(getRegisterEmailMode(env({ NODE_ENV: "development", RENDER: "true" }))).toBe(
      "disabled",
    );
    expect(getRegisterEmailMode(env({ NODE_ENV: "test", VERCEL: "1" }))).toBe("disabled");
  });

  it("nietypowe NODE_ENV albo brak = disabled", () => {
    expect(getRegisterEmailMode(env({ NODE_ENV: "staging" }))).toBe("disabled");
    expect(getRegisterEmailMode(env({}))).toBe("disabled");
  });

  it("niepełne SMTP nie liczy się jako skonfigurowane", () => {
    expect(
      getRegisterEmailMode(env({ NODE_ENV: "production", SMTP_HOST: "h", SMTP_USER: "u" })),
    ).toBe("disabled");
  });
});

describe("getRegistrationAvailability", () => {
  it("blocked tylko gdy brak e-maila i obu dostawców", () => {
    expect(getRegistrationAvailability(env({ NODE_ENV: "production" })).blocked).toBe(true);
    expect(
      getRegistrationAvailability(env({ NODE_ENV: "production", ...GOOGLE })).blocked,
    ).toBe(false);
    expect(
      getRegistrationAvailability(env({ NODE_ENV: "production", ...FACEBOOK })).blocked,
    ).toBe(false);
    expect(getRegistrationAvailability(env({ NODE_ENV: "production", ...SMTP })).blocked).toBe(
      false,
    );
  });

  it("tryb testowy nie blokuje rejestracji", () => {
    expect(getRegistrationAvailability(env({ NODE_ENV: "development" }))).toEqual({
      emailMode: "test",
      google: false,
      facebook: false,
      blocked: false,
    });
  });
});
