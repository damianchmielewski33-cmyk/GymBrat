"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { Smartphone } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QUERY = "(min-width: 1024px) and (pointer: fine) and (hover: hover)";

/** Komputer (szeroki ekran + myszka). Na serwerze i telefonie: false. */
export function useIsDesktopDevice(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export const DESKTOP_TRAINING_MESSAGE =
  "Trening prowadź w aplikacji GymBrat na telefonie. Na komputerze możesz przeglądać plan, historię i analizę.";

export function DesktopTrainingNotice({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center",
        className,
      )}
    >
      <Smartphone className="h-10 w-10 text-[var(--gym-gold)]" aria-hidden />
      <h1 className="font-heading text-xl font-semibold text-white">Trenuj w aplikacji</h1>
      <p className="text-sm leading-relaxed text-white/65">{DESKTOP_TRAINING_MESSAGE}</p>
      <Link href="/workout-plan" className={cn(buttonVariants({ variant: "cta" }), "w-full")}>
        Wróć do planu
      </Link>
    </div>
  );
}

/** Na komputerze zamiast ekranu treningu pokazuje komunikat. */
export function DesktopTrainingGuard({ children }: { children: ReactNode }) {
  const desktop = useIsDesktopDevice();
  return desktop ? <DesktopTrainingNotice className="mt-16" /> : <>{children}</>;
}
