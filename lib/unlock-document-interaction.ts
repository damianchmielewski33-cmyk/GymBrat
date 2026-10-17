/**
 * Dialogi / scroll-lock potrafią zostawić body z `pointer-events: none`
 * po nawigacji (pasek aktywnego treningu → modal → /active-workout).
 * Wywołaj przy wejściu na pełny ekran sesji.
 */
export function unlockDocumentInteraction() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  const body = document.body;

  body.style.pointerEvents = "";
  html.style.pointerEvents = "";
  body.removeAttribute("data-scroll-locked");
  html.removeAttribute("data-scroll-locked");
  body.removeAttribute("inert");
  html.removeAttribute("inert");

  // Osierocone backdropy dialogu po hard unmount (return null paska).
  for (const el of Array.from(
    document.querySelectorAll("[data-slot='alert-dialog-overlay']"),
  )) {
    const portal = el.closest("[data-slot='alert-dialog-portal']");
    const popup = portal?.querySelector("[data-slot='alert-dialog-content']");
    // Usuń tylko gdy nie ma żywego popup / albo overlay zasłania całość bez contentu
    if (!popup || !(popup as HTMLElement).offsetParent) {
      (portal ?? el).remove();
    }
  }
}
