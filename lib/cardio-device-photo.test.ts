import { describe, expect, it } from "vitest";
import {
  cardioLogHasDevicePhoto,
  decryptCardioDevicePhoto,
  encryptCardioDevicePhoto,
} from "@/lib/cardio-device-photo";
import { ENCRYPTED_FIELD_PREFIX } from "@/lib/app-field-crypto";

const SAMPLE =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/Z";

describe("cardio-device-photo", () => {
  it("wykrywa zaszyfrowane i plaintext zdjęcie", () => {
    expect(cardioLogHasDevicePhoto(SAMPLE)).toBe(true);
    expect(cardioLogHasDevicePhoto(`${ENCRYPTED_FIELD_PREFIX}abc`)).toBe(true);
    expect(cardioLogHasDevicePhoto(null)).toBe(false);
  });

  it("encrypt/decrypt roundtrip gdy jest klucz", () => {
    const enc = encryptCardioDevicePhoto(SAMPLE);
    if (!enc?.startsWith(ENCRYPTED_FIELD_PREFIX)) {
      expect(enc).toBe(SAMPLE);
      return;
    }
    expect(decryptCardioDevicePhoto(enc)).toBe(SAMPLE);
  });
});
