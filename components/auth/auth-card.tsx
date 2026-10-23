import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Karta ekranów auth (`glass-panel gold-panel` z dwoma orbami `--neon`). */
export function AuthCard({
  children,
  bodyClassName,
}: {
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className="glass-panel gold-panel relative overflow-hidden p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[var(--neon)]/12 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-16 h-48 w-48 rounded-full bg-[var(--neon)]/8 blur-3xl"
      />
      <div className={cn("relative", bodyClassName)}>{children}</div>
    </div>
  );
}
