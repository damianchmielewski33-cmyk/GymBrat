import { CHANGELOG_ENTRIES } from "@/components/changelog/changelog-data";
import { DeployProvenanceCard } from "@/components/changelog/deploy-provenance";
import { GYMBRAT_GITHUB_URL } from "@/lib/gymbrat-source";
import type { DeployProvenance } from "@/lib/gymbrat-source";
import { isPlannedChangelogEntry } from "@/lib/deploy-changelog";
import { ScreenCard, ScreenHeader, screenLinkClass } from "@/components/layout/screen";

export function ChangelogView({
  variant,
  provenance,
}: {
  variant: "public" | "app";
  provenance: DeployProvenance;
}) {
  return (
    <div className="space-y-8">
      <ScreenHeader
        showBrand={variant === "public"}
        kicker="Produkt"
        title="Nowości i plan"
        description={
          <>
            Changelog GymBrat jest pisany przy wdrożeniach z repozytorium{" "}
            <a href={GYMBRAT_GITHUB_URL} className={screenLinkClass}>
              GymBrat
            </a>
            . Każdy wpis ma jasny opis i źródło w tym repo.
          </>
        }
      />

      <DeployProvenanceCard provenance={provenance} />

      <div className="space-y-6">
        {CHANGELOG_ENTRIES.map((e) => (
          <ScreenCard key={e.title}>
            <h2 className="font-heading text-center text-2xl font-semibold text-white">
              {e.title}
            </h2>
            <p className="mt-2 text-center text-xs text-white/45">
              Źródło: {e.sourceRepo}
              {e.date ? ` · ${e.date}` : ""}
              {e.sha ? ` · ${e.sha}` : ""}
              {isPlannedChangelogEntry(e) ? " · jeszcze niewdrożone" : ""}
            </p>
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
