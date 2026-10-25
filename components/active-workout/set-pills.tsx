"use client";

import { useCallback, useEffect, useRef } from "react";
import { Check, Minus } from "lucide-react";
import type { WorkoutSetState } from "@/components/workout/types";
import type { SessionProgressSegment } from "@/lib/workout-session-progress";
import { formatKgPl } from "@/lib/set-progression-suggestion";
import { scrollEdgeFadeMaskImage, useScrollEdgeFade } from "@/hooks/use-scroll-edge-fade";
import { cn } from "@/lib/utils";

function pillLabel(
  seg: SessionProgressSegment,
  set: WorkoutSetState | undefined,
  selected: boolean,
): string {
  const n = seg.setIndex + 1;
  let label: string;
  if (seg.state === "saved") {
    const reps = set?.reps != null && set.reps > 0 ? ` × ${set.reps}` : "";
    label = `Seria ${n}, zapisana: ${formatKgPl(set?.weight ?? 0)} kg${reps}`;
  } else if (seg.state === "skipped") {
    label = `Seria ${n}, pominięta`;
  } else if (selected) {
    return `Seria ${n}, bieżąca`;
  } else {
    return `Seria ${n}, do zrobienia`;
  }
  return selected ? `${label}, edytujesz` : label;
}

/**
 * Pigułki serii ćwiczenia: numer / ✓ / – oraz złoty pierścień edytowanej.
 * Pole przewija się poziomo, gdy pigułki się nie mieszczą (`chip-scroll`, `compact:`
 * zwęża pole do 9,5 rem — zadanie 004, przegląd wizualny `ux`, poprawka defektu 2).
 * Przewija się wyłącznie to pole (`scrollLeft` grupy), nigdy kolumna treści.
 */
export function SetPills({
  segments,
  sets,
  activeSetIndex,
  onSelect,
}: {
  segments: SessionProgressSegment[];
  sets: WorkoutSetState[];
  activeSetIndex: number;
  onSelect: (setIndex: number) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const edge = useScrollEdgeFade(groupRef, "x", [segments.length]);

  /**
   * Pozycja pigułki względem przewijalnego pola (`group`), licząca z `getBoundingClientRect`,
   * nie z `offsetLeft`/`offsetWidth` (te są względem `offsetParent`, który tu nie jest `group`
   * — stąd regresja z rundy 2 przeglądu: pigułka wybrana/z fokusem była częściowo lub
   * całkowicie poza widocznym polem po kliknięciu, otwarciu i nawigacji klawiaturą).
   */
  const scrollPillIntoView = useCallback(
    (pill: HTMLElement, behavior: ScrollBehavior) => {
      const group = groupRef.current;
      if (!group) return;
      const groupRect = group.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();
      const pillLeft = pillRect.left - groupRect.left + group.scrollLeft;
      const pillRight = pillLeft + pillRect.width;
      const visibleLeft = group.scrollLeft;
      const visibleRight = visibleLeft + group.clientWidth;
      let target: number | null = null;
      if (pillLeft < visibleLeft) target = pillLeft;
      else if (pillRight > visibleRight) target = pillRight - group.clientWidth;
      if (target != null) group.scrollTo({ left: target, behavior });
    },
    [],
  );

  function reducedMotionBehavior(): ScrollBehavior {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  }

  // Bieżąca/wybrana pigułka w całości widoczna od razu po otwarciu ćwiczenia i po
  // każdej zmianie wyboru (klik, „Wstecz”, powrót z menu…).
  useEffect(() => {
    const pill = selectedRef.current;
    if (!pill) return;
    scrollPillIntoView(pill, reducedMotionBehavior());
  }, [activeSetIndex, scrollPillIntoView]);

  const maskImage = scrollEdgeFadeMaskImage("x", edge);

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="Serie ćwiczenia"
      className={cn("chip-scroll max-w-full items-center compact:max-w-[9.5rem]")}
      // `.chip-scroll` dodaje `padding-bottom` na pasek przewijania (ukryty tu przez
      // `scrollbar-width: none`); w kompakcie budżet wysokości nie ma miejsca na te 4 px
      // (ux, przegląd wizualny, defekt 2 — regresja po pierwszej poprawce). Klasa Tailwind
      // nie wygrałaby z `.chip-scroll` (ten sam layer, późniejsza reguła), stąd styl inline.
      style={{
        paddingBottom: 0,
        ...(maskImage ? { maskImage, WebkitMaskImage: maskImage } : null),
      }}
    >
      {segments.map((seg) => {
        const selected = seg.setIndex === activeSetIndex;
        return (
          <button
            key={seg.setIndex}
            type="button"
            aria-pressed={selected}
            aria-label={pillLabel(seg, sets[seg.setIndex], selected)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onSelect(seg.setIndex)}
            // Fokus klawiaturą (Tab) nie zmienia `activeSetIndex`, więc wymaga własnej
            // obsługi — inaczej pigułka z fokusem może zostać poza widocznym polem.
            onFocus={(e) => scrollPillIntoView(e.currentTarget, reducedMotionBehavior())}
            ref={selected ? selectedRef : undefined}
            // Pierścień fokusu do wewnątrz (nie na zewnątrz): domyślny `outline-offset: 2px`
            // (app/globals.css) wychodzi poza przewijalne pole i jest obcinany (ux, runda 3, D-1).
            className="inline-flex h-11 w-11 items-center justify-center focus-visible:outline-offset-[-2px]"
          >
            <span
              aria-hidden
              className={cn(
                "inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border text-[14px] font-bold tabular-nums transition-colors duration-200 motion-reduce:transition-none",
                seg.state === "saved"
                  ? "border-[var(--gym-success)]/60 bg-[var(--gym-success)]/14 text-[var(--gym-success)]"
                  : seg.state === "skipped"
                    ? "border-[var(--gym-skipped)]/60 bg-[var(--gym-skipped)]/12 text-[var(--gym-skipped)]"
                    : selected
                      ? "border-[var(--gym-gold)] bg-[var(--gym-gold)]/18 text-[var(--gym-gold-bright)]"
                      : "border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-white/80",
                selected &&
                  "shadow-[0_0_0_2px_var(--gym-black),0_0_0_4px_var(--gym-gold)]",
              )}
            >
              {seg.state === "saved" ? (
                <Check className="size-4" strokeWidth={2.5} />
              ) : seg.state === "skipped" ? (
                <Minus className="size-4" strokeWidth={2.5} />
              ) : (
                seg.setIndex + 1
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
