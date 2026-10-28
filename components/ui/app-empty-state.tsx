import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Kanoniczny pusty stan aplikacji (huby, listy, community).
 * CommunityEmptyState / MealCatalogEmptyState powinny delegować tutaj.
 */
export function AppEmptyState({
  title,
  description,
  action,
  className,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "app-card flex flex-col items-center px-5 py-10 text-center",
        className,
      )}
      role="status"
    >
      {icon ? (
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/[0.08] text-[var(--gym-gold)]"
          aria-hidden
        >
          {icon}
        </div>
      ) : null}
      <p className="text-[length:var(--text-body-lg)] font-semibold text-white">
        {title}
      </p>
      {description ? (
        <p className="mt-2 max-w-sm text-[length:var(--text-body-sm)] leading-relaxed text-white/55">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}
