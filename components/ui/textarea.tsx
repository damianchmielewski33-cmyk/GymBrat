"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-20 w-full rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-base text-white transition-colors outline-none placeholder:text-white/40 focus-visible:border-[var(--neon)]/55 focus-visible:ring-3 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-black/30 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:disabled:bg-black/40 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

