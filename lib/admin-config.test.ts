import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAdminEmails, resolveEffectiveRole } from "@/lib/admin-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseAdminEmails", () => {
  it("bez zmiennej zwraca pusty zbiór (brak adresu w kodzie)", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(parseAdminEmails().size).toBe(0);
  });

  it("normalizuje adresy z listy", () => {
    vi.stubEnv("ADMIN_EMAILS", " Owner@Example.com , ,second@example.com");
    expect([...parseAdminEmails()]).toEqual(["owner@example.com", "second@example.com"]);
  });
});

describe("resolveEffectiveRole", () => {
  it("zapisany admin pozostaje adminem niezależnie od weryfikacji", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(resolveEffectiveRole({ appRole: "admin", email: "a@x.pl", emailVerified: false })).toBe(
      "admin",
    );
  });

  it("e-mail z listy i zweryfikowany = admin", () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    expect(
      resolveEffectiveRole({ appRole: "zawodnik", email: "OWNER@example.com", emailVerified: true }),
    ).toBe("admin");
  });

  it("e-mail z listy, ale niezweryfikowany = rola z bazy", () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    expect(
      resolveEffectiveRole({ appRole: "zawodnik", email: "owner@example.com", emailVerified: false }),
    ).toBe("zawodnik");
    expect(
      resolveEffectiveRole({ appRole: "trener", email: "owner@example.com", emailVerified: false }),
    ).toBe("trener");
  });

  it("pusta lista i nieznana rola = zawodnik", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(resolveEffectiveRole({ appRole: null, email: "x@y.pl", emailVerified: true })).toBe(
      "zawodnik",
    );
    expect(resolveEffectiveRole({ appRole: "root", email: "x@y.pl", emailVerified: true })).toBe(
      "zawodnik",
    );
  });
});
