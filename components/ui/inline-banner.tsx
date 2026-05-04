"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
  const styles =
    variant === "success"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-50"
      : variant === "warning"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-50"
        : variant === "error"
          ? "border-rose-500/35 bg-rose-500/10 text-rose-50"
          : "border-white/12 bg-white/[0.04] text-white/80";

  return (
    <div
      id={id}
      role={role}
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-[0_12px_44px_rgba(0,0,0,0.35)] backdrop-blur-xl",
        styles,
        className,
      )}
    >
      {children}
    </div>
  );
}

