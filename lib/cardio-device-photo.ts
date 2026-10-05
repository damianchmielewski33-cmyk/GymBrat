import "server-only";

import {
  ENCRYPTED_FIELD_PREFIX,
  encryptSensitiveField,
  maybeDecryptSensitiveField,
} from "@/lib/app-field-crypto";

export function encryptCardioDevicePhoto(
  dataUrl: string | null | undefined,
): string | null {
  const trimmed = dataUrl?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(ENCRYPTED_FIELD_PREFIX)) return trimmed;
  if (!trimmed.startsWith("data:image/")) return null;
  return encryptSensitiveField(trimmed);
}

export function decryptCardioDevicePhoto(
  stored: string | null | undefined,
): string | null {
  const plain = maybeDecryptSensitiveField(stored ?? null);
  if (!plain?.startsWith("data:image/")) return null;
  return plain;
}

export function cardioLogHasDevicePhoto(stored: string | null | undefined): boolean {
  const s = stored?.trim();
  if (!s) return false;
  if (s.startsWith(ENCRYPTED_FIELD_PREFIX)) return true;
  return s.startsWith("data:image/");
}
