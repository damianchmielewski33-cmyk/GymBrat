import crypto from "node:crypto";
import { describe, it, expect, beforeEach } from "vitest";

describe("app-field-crypto", () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
  });

  it("zaszyfruj i odszyfruj token", async () => {
    const { encryptSensitiveField, decryptSensitiveField, ENCRYPTED_FIELD_PREFIX } =
      await import("./app-field-crypto");
    const plain = "fitatu-secret-token-example";
    const enc = encryptSensitiveField(plain);
    expect(enc.startsWith(ENCRYPTED_FIELD_PREFIX)).toBe(true);
    expect(decryptSensitiveField(enc)).toBe(plain);
  });
});
