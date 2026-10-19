export type LevelReward = {
  level: number;
  badgeKey: string;
  badgeTitle: string;
  emoji: string;
  cosmeticKey?: string;
};

export const USER_LEVEL_REWARDS: LevelReward[] = [
  { level: 5, badgeKey: "lvl_user_5", badgeTitle: "Poziom 5", emoji: "5️⃣", cosmeticKey: "frame_bronze" },
  { level: 10, badgeKey: "lvl_user_10", badgeTitle: "Poziom 10", emoji: "🔟", cosmeticKey: "frame_silver" },
  { level: 20, badgeKey: "lvl_user_20", badgeTitle: "Poziom 20", emoji: "⚔️", cosmeticKey: "frame_gold" },
  { level: 30, badgeKey: "lvl_user_30", badgeTitle: "Poziom 30", emoji: "🛡️", cosmeticKey: "frame_platinum" },
  { level: 40, badgeKey: "lvl_user_40", badgeTitle: "Poziom 40", emoji: "💎", cosmeticKey: "frame_diamond" },
  { level: 50, badgeKey: "lvl_user_50", badgeTitle: "Poziom 50", emoji: "👑", cosmeticKey: "frame_obsidian" },
];

export const TEAM_LEVEL_REWARDS: LevelReward[] = [
  { level: 5, badgeKey: "team_lvl_5", badgeTitle: "Team Lv.5", emoji: "🏟️" },
  { level: 10, badgeKey: "team_lvl_10", badgeTitle: "Team Lv.10", emoji: "🏴" },
  { level: 20, badgeKey: "team_lvl_20", badgeTitle: "Team Lv.20", emoji: "🏅" },
  { level: 30, badgeKey: "team_lvl_30", badgeTitle: "Team Lv.30", emoji: "🎖️" },
  { level: 40, badgeKey: "team_lvl_40", badgeTitle: "Team Lv.40", emoji: "🏆" },
];

export function rewardsUnlockedBetween(
  catalog: LevelReward[],
  prevLevel: number,
  nextLevel: number,
): LevelReward[] {
  return catalog.filter((r) => r.level > prevLevel && r.level <= nextLevel);
}
