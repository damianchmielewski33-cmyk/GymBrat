"use client";

/** Ekran „Zapisuję trening…” (ADR 0004 p.3, 005 sekcja 5). */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createPortal } from "react-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { FinishRing } from "@/components/active-workout/finish-ring";
import { isSessionExpiredFinishError } from "@/components/active-workout/use-workout-finish-flow";
import { cn } from "@/lib/utils";

const SLOW_THRESHOLD_MS = 10_000;

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
      <div className={phase === "error" ? "w-full max-w-sm" : "w-full max-w-lg"}>
        {phase === "error" ? (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--destructive)]/35 bg-[var(--destructive)]/10">
            <AlertTriangle className="h-7 w-7 text-[var(--destructive)]" aria-hidden />
          </div>
        ) : (
          <FinishRing mode="loading" className="mx-auto" />
        )}

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-8 font-heading text-[26px] font-semibold leading-tight text-white sm:text-[29px]"
        >
          {phase === "error" ? "Nie udało się zapisać treningu" : "Zapisuję trening…"}
        </h1>

        <p
          className={cn(
            "mt-2 leading-relaxed text-[var(--gym-text-secondary)]",
            phase === "error" ? "text-[14px]" : "text-[13px]",
          )}
        >
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
