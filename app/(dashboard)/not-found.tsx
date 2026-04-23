import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function DashboardNotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-2xl border border-white/15 bg-black/35 p-8 text-center">
      <h2 className="font-heading text-xl font-semibold text-white">Brak strony</h2>
      <p className="text-sm text-white/65">
        Nie znaleziono tego adresu w panelu aplikacji.
      </p>
      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "secondary" }),
          "mx-auto inline-flex border-white/15 bg-white/[0.06]",
        )}
      >
        Wróć na start
      </Link>
    </div>
  );
}
