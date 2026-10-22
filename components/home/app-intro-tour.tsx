"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { completeIntroTourAction } from "@/actions/intro-tour";
import { INTRO_TOUR_STEPS } from "@/lib/intro-tour-steps";
import { cn } from "@/lib/utils";

export function AppIntroTour({ open }: { open: boolean }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(open);
  const [pending, start] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setVisible(open);
    if (open) setStep(0);
  }, [open]);

  if (!mounted || !visible) return null;

  const total = INTRO_TOUR_STEPS.length;
  const current = INTRO_TOUR_STEPS[step]!;
  const isLast = step >= total - 1;
  const progressPct = Math.round(((step + 1) / total) * 100);

  function finish() {
    start(async () => {
      await completeIntroTourAction();
      setVisible(false);
      router.refresh();
    });
  }

  function onNext() {
    if (isLast) {
      finish();
      return;
    }
    setStep((s) => Math.min(total - 1, s + 1));
  }

  const node = (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-tour-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[#0c0c0e] shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
        <div className="h-1 bg-white/[0.08]">
          <div
            className="h-full bg-[var(--gym-gold)] transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
              {current.kicker}
            </p>
            <p className="text-[11px] tabular-nums text-white/35">
              {step + 1} / {total}
            </p>
          </div>

          <h2
            id="intro-tour-title"
            className="text-[22px] font-semibold leading-tight tracking-tight text-white"
          >
            {current.title}
          </h2>
          <p className="text-[14px] leading-relaxed text-white/60">{current.body}</p>

          <div className="flex gap-1.5 pt-1" aria-hidden>
            {INTRO_TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= step ? "bg-[var(--gym-gold)]" : "bg-white/10",
                )}
              />
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              disabled={pending}
              onClick={onNext}
              className="gym-btn-primary h-12 flex-1 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "Zapisywanie…" : isLast ? "Zaczynam" : "Dalej"}
            </button>
            {!isLast ? (
              <button
                type="button"
                disabled={pending}
                onClick={finish}
                className="gym-btn-secondary h-12 flex-1 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Pomiń
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
