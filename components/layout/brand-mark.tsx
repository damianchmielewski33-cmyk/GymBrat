import Link from "next/link";
import { Dumbbell } from "lucide-react";
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
    "inline-flex items-center gap-2 rounded-sm font-heading text-2xl font-semibold text-white",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]/80",
    className,
  );
  const content = (
    <>
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--neon)]/45 bg-[var(--neon)]/15 shadow-[0_0_18px_rgba(var(--neon-rgb),0.22)]"
      >
        <Dumbbell className="h-4 w-4 text-[var(--neon)]" />
      </span>
      <span>
        Gym<span className="text-[var(--neon)]">Brat</span>
      </span>
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
