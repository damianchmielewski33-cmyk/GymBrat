import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScreenCard, ScreenHeading } from "@/components/layout/screen";

export default function DashboardNotFound() {
  return (
    <ScreenCard className="mx-auto max-w-lg">
      <ScreenHeading
        className="mb-8"
        title="Brak strony"
        description="Nie znaleziono tego adresu w panelu aplikacji."
      />
      <Link
        href="/"
        className={cn(buttonVariants({ variant: "cta" }), "w-full")}
      >
        Wróć na start
      </Link>
    </ScreenCard>
  );
}
