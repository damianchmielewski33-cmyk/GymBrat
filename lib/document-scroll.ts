/**
 * Zdejmuje typowe style blokujące przewijanie dokumentu (modale, arkusze).
 * Używane przy zamykaniu paneli i po nawigacji — zapobiega „zaciętemu” scrollowi na mobile.
 */
export function releaseDocumentScrollLock() {
  if (typeof document === "undefined") return;
  const b = document.body;
  const r = document.documentElement;
  b.style.removeProperty("overflow");
  r.style.removeProperty("overflow");
  b.style.removeProperty("padding-right");
  r.style.removeProperty("padding-right");
}
