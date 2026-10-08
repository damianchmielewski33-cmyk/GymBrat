"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useBrandingUrl } from "@/components/branding/branding-provider";

const sizeStyles = {
  /** Nagłówek aplikacji / ekrany wewnętrzne */
  md: {
    wrap: "text-[15px] tracking-[0.12em]",
    img: "h-11 w-auto max-w-[min(72vw,14rem)] sm:h-12 sm:max-w-[15rem]",
  },
  /** Większy wariant (np. puste stany) */
  lg: {
    wrap: "text-lg tracking-[0.1em]",
    img: "h-14 w-auto max-w-[min(80vw,16rem)] sm:h-16 sm:max-w-[18rem]",
  },
} as const;

export function BrandMark({
  href = "/",
  className,
  as = "link",
  size = "md",
}: {
  href?: string;
  className?: string;
  as?: "link" | "span";
  size?: keyof typeof sizeStyles;
}) {
  const logoUrl = useBrandingUrl("logo_app", ["logo_login", "icon_web"]);
  const s = sizeStyles[size];
  const classes = cn(
    "inline-flex max-w-full flex-col rounded-sm font-display font-normal uppercase leading-[0.85] text-[var(--neon)]",
    s.wrap,
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]/80",
    className,
  );
  const content = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt="GymBrat"
      className={cn("object-contain object-left", s.img)}
    />
  ) : (
    <>
      <span>Gym</span>
      <span>Brat</span>
    </>
  );

  if (as === "span") {
    return <span className={classes}>{content}</span>;
  }

  return (
    <Link href={href} className={classes} aria-label="GymBrat — strona główna">
      {content}
    </Link>
  );
}
