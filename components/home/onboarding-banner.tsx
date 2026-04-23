"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { dismissOnboardingAction } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

export function OnboardingBanner() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <section className="rounded-2xl border border-[var(--neon)]/35 bg-[var(--neon)]/[0.08] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/30">
            <Rocket className="h-5 w-5 text-[var(--neon)]" aria-hidden />
          </div>
          <div>
            <p className="font-heading text-base font-semibold text-white">
              Skonfiguruj pierwszy tydzień
            </p>
            <p className="mt-1 text-sm text-white/65">
              Ustal częstotliwość treningów — zajmie to chwilę.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/onboarding"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-[var(--neon)] px-5 text-sm font-medium text-white transition hover:bg-[#ff4d6d]"
          >
            Start
          </Link>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="h-10 border-white/20 bg-transparent text-white/80 hover:bg-white/[0.06]"
            onClick={() => {
              start(async () => {
                await dismissOnboardingAction();
                router.refresh();
              });
            }}
          >
            Później
          </Button>
        </div>
      </div>
    </section>
  );
}
