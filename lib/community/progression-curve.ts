export const USER_MAX_LEVEL = 50;
export const TEAM_MAX_LEVEL = 40;
export const SEASON_MAX_LEVEL = 30;
export const COMMUNITY_MAX_LEVEL = 100;
export const PRESTIGE_MAX = 5;

export function xpNeedForLevel(level: number, base = 100): number {
  return Math.round(base * Math.pow(Math.max(1, level), 1.35));
}

export function levelFromXp(
  xp: number,
  maxLevel: number,
  base = 100,
): number {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (level < maxLevel) {
    const need = xpNeedForLevel(level, base);
    if (remaining < need) break;
    remaining -= need;
    level += 1;
  }
  return level;
}

export function progressInLevel(
  xp: number,
  maxLevel: number,
  base = 100,
): {
  level: number;
  intoLevel: number;
  needForNext: number;
  pct: number;
} {
  let level = 1;
  let remaining = Math.max(0, xp);
  let need = xpNeedForLevel(level, base);
  while (level < maxLevel && remaining >= need) {
    remaining -= need;
    level += 1;
    need = xpNeedForLevel(level, base);
  }
  if (level >= maxLevel) {
    return { level: maxLevel, intoLevel: remaining, needForNext: need, pct: 100 };
  }
  return {
    level,
    intoLevel: remaining,
    needForNext: need,
    pct: need > 0 ? Math.min(100, Math.round((remaining / need) * 100)) : 100,
  };
}

/** Compat wrapper — Challenge UI previously capped at 99; now User track max 50. */
export function xpLevelFromTotal(xp: number): number {
  return levelFromXp(xp, USER_MAX_LEVEL, 100);
}

export function xpProgressInLevel(xp: number) {
  return progressInLevel(xp, USER_MAX_LEVEL, 100);
}
