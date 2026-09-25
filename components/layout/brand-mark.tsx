import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({
  href = "/",
  className,
  as = "link",
}: {
  href?: string;
  className?: string;
  as?: "link" | "span";
}) {
  const classes = cn(
    "inline-flex flex-col rounded-sm font-display text-[13px] font-normal uppercase leading-[0.85] tracking-[0.14em] text-[var(--neon)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]/80",
    className,
  );
  const content = (
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
