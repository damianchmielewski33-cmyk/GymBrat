import Link from "next/link";
import { auth } from "@/auth";
import { ChangelogView } from "@/components/changelog/changelog-view";

export default async function ChangelogPage() {
  const session = await auth();

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6">
        {!session ? (
          <nav className="mb-8 flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/login"
              className="rounded-lg border border-white/15 bg-white/[0.06] px-4 py-2 font-medium text-white/90 transition hover:bg-white/[0.10]"
            >
              Zaloguj się
            </Link>
            <Link
              href="/register"
              className="rounded-lg border border-[var(--neon)]/40 bg-[var(--neon)]/15 px-4 py-2 font-medium text-white transition hover:bg-[var(--neon)]/25"
            >
              Załóż konto
            </Link>
            <Link
              href="/"
              className="text-white/55 underline-offset-4 hover:text-white hover:underline"
            >
              Strona główna aplikacji
            </Link>
          </nav>
        ) : null}
        <ChangelogView variant={session ? "app" : "public"} />
      </div>
    </div>
  );
}
