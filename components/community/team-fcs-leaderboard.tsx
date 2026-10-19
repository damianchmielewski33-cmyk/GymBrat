"use client";

import { useState } from "react";
import { ChevronDown, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TeamRankingRow } from "@/lib/community/teams";
import {
  FCS_COMPONENT_LABELS,
  FCS_WEIGHTS,
  type FcsComponentKey,
} from "@/lib/community/fcs";
import { teamRankingMetricLabel } from "@/lib/community/team-types";

const COMPONENT_ORDER = Object.keys(FCS_WEIGHTS) as FcsComponentKey[];

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function FcsBreakdown({ row }: { row: TeamRankingRow }) {
  if (!row.components) return null;
  return (
    <ul className="mt-2 space-y-1.5 border-t border-white/8 pt-2.5">
      {COMPONENT_ORDER.map((key) => {
        const v = row.components![key] ?? 0;
        const w = FCS_WEIGHTS[key];
        return (
          <li key={key} className="flex items-center gap-2">
            <span className="w-[7.5rem] shrink-0 truncate text-[10px] text-white/45">
              {FCS_COMPONENT_LABELS[key]}
            </span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--gym-gold-deep)] to-[var(--gym-gold)]"
                style={{ width: `${Math.min(100, Math.round(v * 100))}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right font-metric text-[11px] tabular-nums text-white/55">
              {pct(v)}
            </span>
            <span className="w-8 shrink-0 text-right text-[9px] text-white/30">
              ×{Math.round(w * 100)}
            </span>
          </li>
        );
      })}
      {row.newcomerBoost && row.newcomerBoost > 0 ? (
        <li className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-300/90">
          <Sparkles className="h-3 w-3" aria-hidden />
          Bonus nowicjusza +{row.newcomerBoost}
        </li>
      ) : null}
    </ul>
  );
}

export function TeamFcsLeaderboard({
  ranking,
  metric,
}: {
  ranking: TeamRankingRow[];
  metric: TeamRankingRow["metric"];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const isFcs = metric === "fcs";
  const metricLabel = teamRankingMetricLabel(metric);
  const empty = ranking.every((r) => r.score === 0);

  return (
    <section
      className="app-card space-y-3 p-5"
      aria-labelledby="team-ranking-heading"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
          <div>
            <h2
              id="team-ranking-heading"
              className="text-[15px] font-semibold text-white"
            >
              Ranking tygodnia
            </h2>
            {isFcs ? (
              <p className="mt-0.5 text-[11px] leading-snug text-white/40">
                FCS 0–100: progres, regularność, plan, streak, challenge, social,
                pomoc, live — nie same kg.
              </p>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/50">
          {metricLabel}
        </span>
      </div>

      {empty ? (
        <p className="text-[13px] leading-relaxed text-white/45">
          Brak wyników w tym tygodniu — zalicz trening, by wejść na tablicę.
        </p>
      ) : (
        <ol className="space-y-1">
          {ranking.slice(0, 10).map((row) => {
            const expanded = isFcs && openId === row.userId;
            return (
              <li
                key={row.userId}
                className={cn(
                  "rounded-2xl px-2.5 py-2.5",
                  row.rank === 1 &&
                    "border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/[0.08]",
                  row.rank === 2 && "bg-white/[0.03]",
                  row.rank === 3 && "bg-white/[0.02]",
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 text-left"
                  disabled={!isFcs || !row.components}
                  aria-expanded={expanded}
                  onClick={() =>
                    setOpenId((id) => (id === row.userId ? null : row.userId))
                  }
                >
                  <span
                    className={cn(
                      "font-metric flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[14px]",
                      row.rank <= 3
                        ? "bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                        : "text-white/35",
                    )}
                    aria-label={`Miejsce ${row.rank}`}
                  >
                    {row.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-white">
                    {row.displayName}
                    {row.newcomerBoost && row.newcomerBoost > 0 ? (
                      <span className="ml-1.5 text-[10px] font-normal text-emerald-300/80">
                        nowy
                      </span>
                    ) : null}
                  </span>
                  <span className="font-metric text-[15px] tabular-nums text-white/75">
                    {isFcs ? `${row.score}` : row.score}
                    {isFcs ? (
                      <span className="ml-1 text-[10px] text-white/35">FCS</span>
                    ) : null}
                  </span>
                  {isFcs && row.components ? (
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-white/35 transition",
                        expanded && "rotate-180",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </button>
                {expanded ? <FcsBreakdown row={row} /> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
