import { GYMBRAT_GITHUB_URL } from "@/lib/gymbrat-source";
import type { DeployProvenance } from "@/lib/gymbrat-source";

export function DeployProvenanceCard({
  provenance,
}: {
  provenance: DeployProvenance;
}) {
  return (
    <section
      className="glass-panel neon-glow p-6"
      aria-labelledby="deploy-provenance-heading"
    >
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">
        Wdrożenie
      </p>
      <h2
        id="deploy-provenance-heading"
        className="font-heading mt-2 text-lg font-semibold text-white"
      >
        Źródło tej wersji: repozytorium GymBrat
      </h2>
      <p className="mt-2 text-sm text-white/65">
        Opis zmian i kod produkcyjny mają pochodzić wyłącznie z{" "}
        <a
          href={GYMBRAT_GITHUB_URL}
          className="text-[var(--neon)] underline-offset-4 hover:underline"
        >
          {provenance.slug}
        </a>
        . Inne repozytoria (np. AWP) nie są źródłem changelogu GymBrat.
      </p>
      <dl className="mt-4 grid gap-3 text-sm text-white/80 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-[0.16em] text-white/45">
            Środowisko
          </dt>
          <dd className="mt-1 font-medium">{provenance.environment}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.16em] text-white/45">
            Gałąź
          </dt>
          <dd className="mt-1 font-medium">{provenance.ref ?? "nieustawiona lokalnie"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.16em] text-white/45">
            Commit
          </dt>
          <dd className="mt-1 font-mono text-[13px]">
            {provenance.commitUrl ? (
              <a
                href={provenance.commitUrl}
                className="text-[var(--neon)] underline-offset-4 hover:underline"
              >
                {provenance.shortSha ?? "zobacz repozytorium"}
              </a>
            ) : (
              "lokalny build bez SHA"
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.16em] text-white/45">
            Zaufanie źródła
          </dt>
          <dd className="mt-1 font-medium">
            {provenance.sourceTrusted
              ? "Tak — deploy zgłasza repozytorium GymBrat"
              : "Nie — ten build nie pochodzi z kanonicznego GymBrat"}
          </dd>
        </div>
      </dl>
      {provenance.message ? (
        <p className="mt-4 text-sm text-white/70">
          <span className="text-white/45">Ostatni komunikat commita: </span>
          {provenance.message}
        </p>
      ) : null}
      {!provenance.sourceTrusted ? (
        <p className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          Agent wdrożeń odrzuca ten build jako źródło zmian GymBrat. Wdróż ponownie
          z {GYMBRAT_GITHUB_URL}.
        </p>
      ) : null}
    </section>
  );
}
