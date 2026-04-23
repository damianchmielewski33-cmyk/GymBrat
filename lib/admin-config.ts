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
