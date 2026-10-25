"use client";

/** Ekran „Zapisuję trening…” (ADR 0004 p.3, 005 sekcja 5). */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { createPortal } from "react-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { isSessionExpiredFinishError } from "@/components/active-workout/use-workout-finish-flow";

const SLOW_THRESHOLD_MS = 10_000;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export type WorkoutSavingScreenProps = {
  phase: "saving" | "error";
  errorMessage?: string;
  onRetry: () => void;
  onReturnToWorkout: () => void;
};

export function WorkoutSavingScreen({
  phase,
  errorMessage,
  onRetry,
  onReturnToWorkout,
}: WorkoutSavingScreenProps) {
  const [mounted, setMounted] = useState(false);
  const [slow, setSlow] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (phase !== "saving") {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const sessionExpired = phase === "error" && isSessionExpiredFinishError(errorMessage ?? "");

  const content = (
    <div
      className="fixed inset-0 z-[1200] flex flex-col items-center justify-center bg-[var(--gym-black)] px-6 text-center text-white"
      role={phase === "error" ? "alert" : "status"}
      aria-live={phase === "error" ? undefined : "polite"}
      aria-busy={phase === "saving"}
    >
      <div className="w-full max-w-lg">
        <div
          className={
            phase === "error"
              ? "mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--destructive)]/35 bg-[var(--destructive)]/10"
              : "mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10"
          }
        >
          {phase === "error" ? (
            <AlertTriangle className="h-7 w-7 text-[var(--destructive)]" aria-hidden />
          ) : reducedMotion ? (
            <Save className="h-7 w-7 text-[var(--gym-gold)]" aria-hidden />
          ) : (
            <Loader2 className="h-7 w-7 animate-spin text-[var(--gym-gold)]" aria-hidden />
          )}
        </div>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-5 font-heading text-[26px] font-semibold leading-tight text-white sm:text-[29px]"
        >
          {phase === "error" ? "Nie udało się zapisać treningu" : "Zapisuję trening…"}
        </h1>

        <p className="mt-2 text-[13px] leading-relaxed text-[var(--gym-text-secondary)]">
          {phase === "error"
            ? sessionExpired
              ? "Zaloguj się ponownie, a serie zostaną na ekranie."
              : "Twoje serie są nadal na ekranie."
            : slow
              ? "Wolne połączenie, nadal zapisujemy…"
              : "Nie zamykaj aplikacji."}
        </p>

        {phase === "error" ? (
          <div className="mt-6 flex flex-col gap-2.5">
            {sessionExpired ? (
              <a href="/login" className={buttonVariants({ variant: "cta", className: "h-14 w-full" })}>
                Zaloguj się
              </a>
            ) : (
              <Button type="button" variant="cta" className="h-14 w-full" onClick={onRetry}>
                Spróbuj ponownie
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full border-[var(--gym-border-gold)] text-white/80"
              onClick={onReturnToWorkout}
            >
              Wróć do treningu
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}

export { SLOW_THRESHOLD_MS };
