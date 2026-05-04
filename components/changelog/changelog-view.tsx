import Link from "next/link";
import { CHANGELOG_ENTRIES } from "@/components/changelog/changelog-data";

export function ChangelogView({
  variant,
}: {
  /** `public` — link do eksportu tylko dla zalogowanych (Profil). */
  variant: "public" | "app";
}) {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
          Produkt
        </p>
        <h1 className="font-heading metallic-text mt-2 text-3xl font-semibold">
          Nowości i plan
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/65">
          Krótki changelog GymBrat — aktualizujemy go wraz z wdrożeniami.
          {variant === "app" ? (
            <>
              {" "}
              Pełna kopia danych:
              <Link href="/profile#export-data" className="ml-1 text-[var(--neon)] underline">
                Profil → eksport
              </Link>
              .
            </>
          ) : (
            <>
              {" "}
              Po zalogowaniu możesz pobrać swoje dane w Profilu (JSON / CSV).
            </>
          )}
        </p>
      </header>

      <div className="space-y-6">
        {CHANGELOG_ENTRIES.map((e) => (
          <section key={e.title} className="glass-panel neon-glow p-6">
            <h2 className="font-heading text-lg font-semibold text-white">{e.title}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-white/75">
              {e.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
