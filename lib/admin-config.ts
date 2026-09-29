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

/** Główny administrator — zawsze admin; tylko on nadaje rolę admin innym. */
export const PRIMARY_ADMIN_EMAIL = "damianchmielewski33@gmail.com";

export function normalizeAdminEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isPrimaryAdminEmail(email: string | null | undefined): boolean {
  return normalizeAdminEmail(email) === PRIMARY_ADMIN_EMAIL;
}

/** E-maile z automatyczną rolą admin (PRIMARY + ADMIN_EMAILS). */
export function parseAdminEmails(): Set<string> {
  const out = new Set<string>([PRIMARY_ADMIN_EMAIL]);
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return out;
  for (const s of raw.split(",")) {
    const t = s.trim().toLowerCase();
    if (t) out.add(t);
  }
  return out;
}
