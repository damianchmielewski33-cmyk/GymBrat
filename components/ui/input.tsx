import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 min-h-11 w-full min-w-0 rounded-lg border border-white/20 bg-black/50 px-3 py-2 text-base text-white transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-white placeholder:text-white/40 focus-visible:border-[var(--neon)]/55 focus-visible:ring-[3px] focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-black/30 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:disabled:bg-black/40 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
