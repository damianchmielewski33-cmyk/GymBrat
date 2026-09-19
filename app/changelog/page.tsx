import Link from "next/link";
import { auth } from "@/auth";
import { ChangelogView } from "@/components/changelog/changelog-view";
import { readDeployProvenance } from "@/lib/gymbrat-source";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChangelogPage() {
  const session = await auth();
  const provenance = readDeployProvenance();

  if (session?.user) {
    return <ChangelogView variant="app" provenance={provenance} />;
  }

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col justify-center px-4 py-12 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-[calc(3rem+env(safe-area-inset-top))] sm:py-16">
        <nav className="mb-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "cta" }), "w-full sm:w-auto")}
          >
            Zaloguj się
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ variant: "secondary" }), "w-full sm:w-auto")}
          >
            Załóż konto
          </Link>
        </nav>
        <ChangelogView variant="public" provenance={provenance} />
      </div>
    </div>
  );
}
