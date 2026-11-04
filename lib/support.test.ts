import { describe, expect, it } from "vitest";
import { SUPPORT_RESPONSE_DAYS, supportDueAt, supportRequestSchema } from "@/lib/support";

describe("support (Z50)", () => {
  it("termin odpowiedzi to 14 dni od zgłoszenia", () => {
    const created = new Date("2026-11-02T10:00:00Z");
    expect(SUPPORT_RESPONSE_DAYS).toBe(14);
    expect(supportDueAt(created).toISOString()).toBe("2026-11-16T10:00:00.000Z");
  });

  it("schemat odrzuca za krótki temat/opis i nieznany rodzaj", () => {
    const ok = { kind: "complaint", subject: "Brak pakietu", message: "Zapłaciłem, pakiet nie działa." };
    expect(supportRequestSchema.safeParse(ok).success).toBe(true);
    expect(supportRequestSchema.safeParse({ ...ok, subject: "ab" }).success).toBe(false);
    expect(supportRequestSchema.safeParse({ ...ok, message: "krótko" }).success).toBe(false);
    expect(supportRequestSchema.safeParse({ ...ok, kind: "inne-xyz" }).success).toBe(false);
  });
});
