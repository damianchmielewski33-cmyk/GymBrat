import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Prefiks zaszyfrowanych wartości w DB (AES-256-GCM). */
export const ENCRYPTED_FIELD_PREFIX = "gbenc:v1:";

function getKey32(): Buffer | null {
  const raw = process.env.APP_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch {
    /* ignore */
  }
  try {
    const b = Buffer.from(raw, "hex");
    if (b.length === 32) return b;
  } catch {
    /* ignore */
  }
  return null;
}

export function hasAppEncryptionKey(): boolean {
  return getKey32() !== null;
}

/**
 * Szyfruje pojedyncze pole tekstowe. Bez klucza zwraca plaintext (tylko dev / ostrzeżenie).
 */
export function encryptSensitiveField(plain: string): string {
  const key = getKey32();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[app-field-crypto] Brak APP_ENCRYPTION_KEY — zapisujemy wrażliwe pole jako plaintext.",
      );
    }
    return plain;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, tag, enc]);
  return `${ENCRYPTED_FIELD_PREFIX}${blob.toString("base64url")}`;
}

export function decryptSensitiveField(stored: string): string {
  if (!stored.startsWith(ENCRYPTED_FIELD_PREFIX)) return stored;
  const key = getKey32();
  if (!key) {
    throw new Error("APP_ENCRYPTION_KEY wymagany do odczytu zaszyfrowanych danych.");
  }
  const buf = Buffer.from(stored.slice(ENCRYPTED_FIELD_PREFIX.length), "base64url");
  if (buf.length < 12 + 16) throw new Error("Uszkodzony blob szyfrowania.");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Odszyfruj jeśli prefiks; w przeciwnym razie zwróć jak jest (legacy). */
export function maybeDecryptSensitiveField(stored: string | null): string | null {
  if (stored == null || stored === "") return null;
  if (!stored.startsWith(ENCRYPTED_FIELD_PREFIX)) return stored;
  try {
    return decryptSensitiveField(stored);
  } catch (e) {
    console.error("[app-field-crypto] Odszyfrowanie nie powiodło się:", e);
    return stored;
  }
}
