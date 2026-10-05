/**
 * Ograniczenie śladu w DevTools przeglądarki (produkcja).
 * Nie „blokuje” F12 — to niemożliwe wiarygodnie — ale ogranicza React DevTools
 * i logi konsoli, żeby mniej wyciekało przy zwykłym użyciu narzędzi.
 */

const NOOP = (): void => undefined;

function neutralizeReactDevTools(): void {
  try {
    const hook = (
      window as Window & {
        __REACT_DEVTOOLS_GLOBAL_HOOK__?: Record<string, unknown>;
      }
    ).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!hook || typeof hook !== "object") return;
    for (const key of Object.keys(hook)) {
      const value = hook[key];
      hook[key] = typeof value === "function" ? NOOP : null;
    }
  } catch {
    /* ignore */
  }
}

function silenceConsole(): void {
  try {
    const methods = [
      "log",
      "debug",
      "info",
      "warn",
      "table",
      "dir",
      "dirxml",
      "group",
      "groupCollapsed",
      "groupEnd",
      "trace",
      "time",
      "timeEnd",
      "timeLog",
      "assert",
      "count",
      "countReset",
    ] as const;
    for (const m of methods) {
      try {
        // eslint-disable-next-line no-console
        console[m] = NOOP as never;
      } catch {
        /* ignore */
      }
    }
    // Pełny Error object w konsoli często zdradza ścieżki i stan — skróć.
    // eslint-disable-next-line no-console
    console.error = (...args: unknown[]) => {
      try {
        const first = args[0];
        if (typeof first === "string") {
          // eslint-disable-next-line no-console
          console.error.call(console, first.slice(0, 180));
        }
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* ignore */
  }
}

let applied = false;

/** Idempotentne — wołaj jak najwcześniej po stronie klienta. */
export function applyClientHardening(): void {
  if (applied) return;
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") return;
  applied = true;
  neutralizeReactDevTools();
  silenceConsole();
}
