"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    box: "border-state-success/30 bg-state-success/10 text-state-success shadow-[0_12px_36px_-14px_rgba(16,185,129,0.45)]",
    badge: "bg-state-success/15 text-state-success",
  },
  warning: {
    icon: AlertTriangle,
    box: "border-state-warning/30 bg-state-warning/10 text-state-warning shadow-[0_12px_36px_-14px_rgba(245,158,11,0.45)]",
    badge: "bg-state-warning/15 text-state-warning",
  },
  error: {
    icon: XCircle,
    box: "border-state-error/35 bg-state-error/10 text-state-error shadow-[0_12px_36px_-14px_rgba(244,63,94,0.5)]",
    badge: "bg-state-error/15 text-state-error",
  },
  info: {
    icon: Info,
    box: "border-white/12 bg-white/[0.04] text-white/80 shadow-[0_12px_36px_-16px_rgba(0,0,0,0.7)]",
    badge: "bg-white/10 text-white/70",
  },
} as const;

/** Komunikat w treści ekranu: ikona + tekst, wjeżdża z animacją. */
export function InlineBanner({
  variant = "info",
  children,
  className,
  id,
  role,
}: {
  variant?: "info" | "success" | "warning" | "error";
  children: ReactNode;
  className?: string;
  id?: string;
  role?: "status" | "alert";
}) {
  const v = VARIANTS[variant];
  const Icon = v.icon;

  return (
    <div
      id={id}
      role={role}
      className={cn(
        "app-dialog-rise flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-sm leading-relaxed backdrop-blur-xl",
        v.box,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "app-dialog-pop mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          v.badge,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </div>
  );
}
