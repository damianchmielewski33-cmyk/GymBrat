import Link from "next/link";
import { CHANGELOG_ENTRIES } from "@/components/changelog/changelog-data";
import { ScreenCard, ScreenHeader, screenLinkClass } from "@/components/layout/screen";

export function ChangelogView({
  variant,
}: {
  /** `public` — link do eksportu tylko dla zalogowanych (Profil). */
  variant: "public" | "app";
}) {
  return (
    <div className="space-y-8">
      <ScreenHeader
        showBrand={variant === "public"}
        kicker="Produkt"
        title="Nowości i plan"
        description={
          <>
            Krótki changelog GymBrat — aktualizujemy go wraz z wdrożeniami.
            {variant === "app" ? (
              <>
                {" "}
                Pełna kopia danych:{" "}
                <Link href="/profile#export-data" className={screenLinkClass}>
                  Profil → eksport
                </Link>
                .
              </>
            ) : (
              <> Po zalogowaniu możesz pobrać swoje dane w Profilu (JSON / CSV).</>
            )}
          </>
        }
      />

      <div className="space-y-6">
        {CHANGELOG_ENTRIES.map((e) => (
          <ScreenCard key={e.title}>
            <h2 className="font-heading text-center text-2xl font-semibold text-white">{e.title}</h2>
            <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-white/75">
              {e.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </ScreenCard>
        ))}
      </div>
    </div>
  );
}
