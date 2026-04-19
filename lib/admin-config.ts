/** PIN odblokowujący panel po zalogowaniu (zmienny przez ENV w produkcji). */
export function getAdminPin(): string {
  return (
    process.env.ADMIN_PIN?.trim() ??
    /** Domyślnie zgodnie z konfiguracją projektu (nadpisz ADMIN_PIN na produkcji). */
    "1998"
  );
}
