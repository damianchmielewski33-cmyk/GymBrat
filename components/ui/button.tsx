import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-2xl bg-clip-padding text-sm font-semibold whitespace-nowrap outline-none select-none transition-all focus-visible:ring-[3px] focus-visible:ring-[rgba(var(--neon-rgb),0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708] disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "gym-btn-primary h-11 px-5",
        cta: "gym-btn-primary h-12 rounded-2xl px-6 text-base tracking-[0.02em]",
        outline: "gym-btn-outline h-11 px-5",
        secondary: "gym-btn-secondary h-11 px-5",
        ghost:
          "h-11 border border-transparent bg-transparent text-white/80 hover:bg-[rgba(var(--neon-rgb),0.14)] hover:text-[var(--gym-gold-bright)] aria-expanded:bg-[rgba(var(--neon-rgb),0.14)] aria-expanded:text-[var(--gym-gold-bright)]",
        destructive:
          "h-11 border border-destructive/35 bg-destructive/15 font-semibold text-destructive hover:bg-destructive/25 focus-visible:ring-destructive/35",
        link: "h-auto rounded-none border-0 bg-transparent px-0 text-[var(--neon)] underline-offset-4 hover:text-[var(--gym-gold-bright)] hover:underline",
      },
      size: {
        default:
          "gap-1.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-xl px-2.5 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 rounded-xl px-3.5 text-[0.8rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10 rounded-2xl",
        "icon-xs": "size-7 rounded-xl [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 rounded-xl",
        "icon-lg": "size-11 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
