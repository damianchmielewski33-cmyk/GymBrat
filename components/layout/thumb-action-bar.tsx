import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky belka CTA w dolnej strefie kciuka (nad bottom nav).
 * Mobile-first: pełna szerokość, bezpieczny inset.
 */
export function ThumbActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[48] px-[var(--space-screen-x)] sm:px-[var(--space-screen-x-sm)]",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]",
        "md:bottom-[calc(5rem+env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-auto mx-auto flex w-full max-w-lg gap-2",
          "md:max-w-xl xl:max-w-2xl",
          "rounded-[var(--radius-panel)] border border-white/[0.08] bg-black/80 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl",
        )}
      >
        {children}
      </div>
    </div>
  );
}
