"use client";

import { WAR_LEAGUE_META } from "@/lib/community/team-war-types";

export function WarMatchCard({
  war,
  highlightTeamId,
}: {
  war: {
    id: string;
    teamAId: string;
    teamBId: string;
    scoreA: number;
    scoreB: number;
    endsAt: Date;
    status: string;
  };
  highlightTeamId?: string;
}) {
  const remaining = Math.max(0, war.endsAt.getTime() - Date.now());
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const leadA = war.scoreA >= war.scoreB;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/50 p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,113,133,0.12),transparent_55%)]" />
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-left">
          <p
            className={
              highlightTeamId === war.teamAId
                ? "font-heading text-[16px] text-[var(--gym-gold)]"
                : "font-heading text-[16px] text-white"
            }
          >
            Team A
          </p>
          <p className="mt-1 font-metric text-[28px] text-white">
            {war.scoreA.toFixed(1)}
          </p>
          <p className="text-[11px] text-white/40">FCS</p>
        </div>
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-widest text-rose-300/80">
            vs
          </p>
          <p className="mt-2 text-[12px] text-white/50">
            {days}d {hours}h
          </p>
        </div>
        <div className="text-right">
          <p
            className={
              highlightTeamId === war.teamBId
                ? "font-heading text-[16px] text-[var(--gym-gold)]"
                : "font-heading text-[16px] text-white"
            }
          >
            Team B
          </p>
          <p className="mt-1 font-metric text-[28px] text-white">
            {war.scoreB.toFixed(1)}
          </p>
          <p className="text-[11px] text-white/40">FCS</p>
        </div>
      </div>
      <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--gym-gold)] to-rose-400 transition-all duration-700"
          style={{
            width: `${Math.min(100, Math.max(8, leadA ? 55 + (war.scoreA - war.scoreB) : 45 - (war.scoreB - war.scoreA)))}%`,
          }}
        />
      </div>
      <p className="relative mt-2 text-center text-[11px] text-white/40">
        {WAR_LEAGUE_META.bronze.label}+ · live score odświeżany przy wejściu
      </p>
    </article>
  );
}
