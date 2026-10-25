"use client";

import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";

export type ScrollEdgeFade = { start: boolean; end: boolean };

/**
 * Wskazówka krawędzi przewijanego pola: `start`/`end` to `true`, gdy jest ukryta treść
 * w tym kierunku (lewo/prawo dla `"x"`, góra/dół dla `"y"`). Aktualizowane na `scroll`
 * i `resize`; `extraDeps` wymusza przeliczenie też po zmianie zawartości (np. liczby
 * elementów), bo sama zmiana rozmiaru nie emituje zdarzenia `scroll`.
 */
export function useScrollEdgeFade(
  ref: RefObject<HTMLElement | null>,
  axis: "x" | "y",
  extraDeps: readonly unknown[] = [],
): ScrollEdgeFade {
  const [edge, setEdge] = useState<ScrollEdgeFade>({ start: false, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (axis === "x") {
      const max = el.scrollWidth - el.clientWidth;
      setEdge({ start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 });
    } else {
      const max = el.scrollHeight - el.clientHeight;
      setEdge({ start: el.scrollTop > 1, end: el.scrollTop < max - 1 });
    }
  }, [ref, axis]);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, ...extraDeps]);

  return edge;
}

/** Szerokość/wysokość gradientu do przezroczystości na krawędzi (bez strzałek/liczników). */
export const SCROLL_EDGE_FADE_PX = 24;

/** `mask-image` (i `WebkitMaskImage`) wyłącznie na krawędziach z ukrytą treścią. */
export function scrollEdgeFadeMaskImage(
  axis: "x" | "y",
  edge: ScrollEdgeFade,
): string | undefined {
  const dir = axis === "x" ? "to right" : "to bottom";
  const px = SCROLL_EDGE_FADE_PX;
  if (edge.start && edge.end) {
    return `linear-gradient(${dir}, transparent, black ${px}px, black calc(100% - ${px}px), transparent)`;
  }
  if (edge.start) return `linear-gradient(${dir}, transparent, black ${px}px)`;
  if (edge.end) return `linear-gradient(${dir}, black, black calc(100% - ${px}px), transparent)`;
  return undefined;
}
