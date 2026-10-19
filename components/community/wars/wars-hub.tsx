"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowLeft, Swords } from "lucide-react";
import { WarLeagueBadge } from "@/components/community/wars/war-league-badge";
import { WarMatchCard } from "@/components/community/wars/war-match-card";
import { WarSeasonStandings } from "@/components/community/wars/war-season-standings";
import {
  cancelWarQueueAction,
  queueWarAction,
} from "@/actions/community-wars";
import type { getWarsHubData } from "@/lib/community/team-wars";
import type { WarLeague } from "@/lib/community/team-war-types";

type HubData = Awaited<ReturnType<typeof getWarsHubData>>;

export function WarsHub({ data }: { data: HubData }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <Link
        href="/community"
        className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Community
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-rose-400/25 bg-gradient-to-br from-rose-500/15 via-black/40 to-transparent p-5">
        <div className="flex items-start gap-3">
          <Swords className="mt-1 h-7 w-7 text-rose-300" />
          <div>
            <p className="app-label text-rose-300">Team Wars</p>
            <h1 className="mt-1 font-heading text-[26px] font-semibold text-white">
              Wojny drużyn
            </h1>
            <p className="mt-2 text-[13px] text-white/50">
              Sezon {data.seasonKey} · 7 dni · wynik na Fair Competition Score
            </p>
          </div>
        </div>
      </header>

      {data.liveWars.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-[17px] font-semibold text-white">
            Trwające wojny
          </h2>
          {data.liveWars.map(({ team, war }) => (
            <WarMatchCard key={war.id} war={war} highlightTeamId={team.teamId} />
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-heading text-[17px] font-semibold text-white">
          Twoje grupy
        </h2>
        <div className="space-y-2">
          {data.queues.map(({ team, queued, stats }) => (
            <div
              key={team.teamId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <div>
                <p className="font-medium text-white">{team.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <WarLeagueBadge league={stats.league as WarLeague} />
                  <span className="text-[12px] text-white/45">{stats.lp} LP</span>
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3.5 py-2 text-[12px] font-medium text-rose-100 disabled:opacity-50"
                onClick={() =>
                  start(async () => {
                    if (queued) await cancelWarQueueAction(team.teamId);
                    else await queueWarAction(team.teamId);
                    router.refresh();
                  })
                }
              >
                {queued ? "Anuluj kolejkę" : "Szukaj przeciwnika"}
              </button>
            </div>
          ))}
          {data.queues.length === 0 ? (
            <p className="text-[13px] text-white/40">
              Dołącz do grupy, żeby walczyć w Team Wars.
            </p>
          ) : null}
        </div>
      </section>

      <WarSeasonStandings standings={data.standings} />
    </div>
  );
}
