export const WAR_LEAGUES = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
] as const;
export type WarLeague = (typeof WAR_LEAGUES)[number];

export const WAR_LEAGUE_THRESHOLDS: Record<WarLeague, number> = {
  bronze: 0,
  silver: 100,
  gold: 250,
  platinum: 500,
  diamond: 900,
};

export const WAR_LEAGUE_META: Record<
  WarLeague,
  { label: string; pillClass: string }
> = {
  bronze: {
    label: "Bronze",
    pillClass: "border-amber-700/50 bg-amber-900/35 text-amber-200",
  },
  silver: {
    label: "Silver",
    pillClass: "border-slate-300/40 bg-slate-400/20 text-slate-100",
  },
  gold: {
    label: "Gold",
    pillClass:
      "border-[var(--gym-gold)]/45 bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]",
  },
  platinum: {
    label: "Platinum",
    pillClass: "border-cyan-300/45 bg-cyan-400/15 text-cyan-100",
  },
  diamond: {
    label: "Diamond",
    pillClass: "border-sky-200/50 bg-sky-300/15 text-sky-100",
  },
};

export const WAR_WIN_LP = 25;
export const WAR_LOSS_LP = 15;
export const WAR_DRAW_LP = 5;
export const WAR_DURATION_MS = 7 * 86_400_000;

export function leagueFromLp(lp: number): WarLeague {
  const p = Math.max(0, lp);
  if (p >= WAR_LEAGUE_THRESHOLDS.diamond) return "diamond";
  if (p >= WAR_LEAGUE_THRESHOLDS.platinum) return "platinum";
  if (p >= WAR_LEAGUE_THRESHOLDS.gold) return "gold";
  if (p >= WAR_LEAGUE_THRESHOLDS.silver) return "silver";
  return "bronze";
}

export function applyLpDelta(lp: number, delta: number): {
  lp: number;
  league: WarLeague;
} {
  const next = Math.max(0, lp + delta);
  return { lp: next, league: leagueFromLp(next) };
}
