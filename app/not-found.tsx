import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScreenCard, ScreenHeading } from "@/components/layout/screen";
import { ERROR_CATALOG } from "@/lib/errors/catalog";

export default function RootNotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4">
      <ScreenCard className="w-full">
        <ScreenHeading
          showBrand
          className="mb-8"
          title="404 — nie znaleziono strony"
          description={ERROR_CATALOG.NOT_FOUND.message}
        />
        <Link href="/" className={cn(buttonVariants({ variant: "cta" }), "w-full")}>
          Wróć na start
        </Link>
      </ScreenCard>
    </div>
  );
}
