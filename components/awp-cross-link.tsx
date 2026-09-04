"use client";

import { ExternalLink, Trophy } from "lucide-react";
import { AWP_SITE_NAME, AWP_SITE_TAGLINE, getAwpCrossLink } from "@/lib/sister-sites";
import { cn } from "@/lib/utils";

export function AwpCrossLink({
  className,
  variant = "nav",
  onClick,
}: {
  className?: string;
  variant?: "nav" | "sheet" | "banner" | "footer";
  onClick?: () => void;
}) {
  const href = getAwpCrossLink("/");

  if (variant === "banner" || variant === "footer") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={cn(
          "group flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-950/40 px-3 py-2.5 text-left transition-colors hover:bg-emerald-900/50",
          className
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/40">
          <Trophy className="h-4 w-4 text-emerald-300" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">{AWP_SITE_NAME}</span>
          <span className="block text-xs text-emerald-100/75">{AWP_SITE_TAGLINE}</span>
        </span>
        <ExternalLink className="h-4 w-4 shrink-0 text-white/40 group-hover:text-white/80" aria-hidden />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-emerald-200/90 transition-colors hover:bg-emerald-500/10 hover:text-emerald-100",
        variant === "sheet" && "w-full px-3 py-3",
        className
      )}
    >
      <Trophy className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{AWP_SITE_NAME}</span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
    </a>
  );
}

/** Mały skrót w headerze desktop. */
export function AwpHeaderChip({ className }: { className?: string }) {
  return (
    <a
      href={getAwpCrossLink("/")}
      target="_blank"
      rel="noopener noreferrer"
      title={AWP_SITE_TAGLINE}
      className={cn(
        "hidden items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-500/20 lg:inline-flex",
        className
      )}
    >
      <Trophy className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
      AWP
      <ExternalLink className="h-3 w-3 opacity-50" aria-hidden />
    </a>
  );
}
