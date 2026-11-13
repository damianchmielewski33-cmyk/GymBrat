import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Jeden wzorzec „wstecz” na podekranach: strzałka + etykieta, cel dotykowy min. 44 px. */
export function BackLink({
  href,
  label = "Wstecz",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-[13px] text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}
