import { WarLeagueBadge } from "@/components/community/wars/war-league-badge";
import type { WarLeague } from "@/lib/community/team-war-types";

export function WarSeasonStandings({
  standings,
}: {
  standings: Array<{
    teamId: string;
    name: string;
    league: string;
    lp: number;
    wins: number;
    losses: number;
    draws: number;
  }>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-[17px] font-semibold text-white">
        Ranking ligowy sezonu
      </h2>
      {standings.length === 0 ? (
        <p className="text-[13px] text-white/40">Brak jeszcze meczów w sezonie.</p>
      ) : (
        <ol className="space-y-2">
          {standings.map((s, i) => (
            <li
              key={s.teamId}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <span className="font-metric w-6 text-white/40">#{i + 1}</span>
                <div>
                  <p className="text-[14px] text-white">{s.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <WarLeagueBadge league={s.league as WarLeague} />
                    <span className="text-[11px] text-white/40">
                      {s.wins}W {s.losses}L {s.draws}D
                    </span>
                  </div>
                </div>
              </div>
              <span className="font-metric text-[16px] text-[var(--gym-gold)]">
                {s.lp}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
