/** PIN odblokowujący panel po zalogowaniu (zmienny przez ENV w produkcji). */
export function getAdminPin(): string {
  const v = process.env.ADMIN_PIN?.trim();
  if (v) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing ADMIN_PIN");
  }
  // Dev-only fallback: ułatwia lokalne uruchomienie bez konfiguracji sekretów.
  return "1998";
}

export type AppRole = "zawodnik" | "trener" | "admin";

export function normalizeAdminEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/** E-maile z `ADMIN_EMAILS` (bez adresów zapisanych w kodzie, LR-28). */
export function parseAdminEmails(): Set<string> {
  const out = new Set<string>();
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return out;
  for (const s of raw.split(",")) {
    const t = normalizeAdminEmail(s);
    if (t) out.add(t);
  }
  return out;
}

/**
 * Jedyne miejsce reguły roli (ADR 0001 D6): admin, gdy rola zapisana w bazie to admin,
 * albo gdy e-mail jest na liście `ADMIN_EMAILS` **i** jest zweryfikowany.
 */
export function resolveEffectiveRole(input: {
  appRole: string | null | undefined;
  email: string | null | undefined;
  emailVerified: boolean;
}): AppRole {
  if (input.appRole === "admin") return "admin";
  if (input.emailVerified && parseAdminEmails().has(normalizeAdminEmail(input.email))) {
    return "admin";
  }
  return input.appRole === "trener" ? "trener" : "zawodnik";
}
