export const HOF_PERIOD_KINDS = [
  "week",
  "month",
  "season",
  "year",
  "all_time",
] as const;
export type HofPeriodKind = (typeof HOF_PERIOD_KINDS)[number];

export const HOF_CATEGORIES = [
  "most_progress",
  "longest_streak",
  "most_helpful",
  "challenge_master",
  "workout_beast",
  "community_hero",
  "team_legend",
] as const;
export type HofCategory = (typeof HOF_CATEGORIES)[number];

export const HOF_CATEGORY_META: Record<
  HofCategory,
  { label: string; emoji: string; description: string; accentClass: string }
> = {
  most_progress: {
    label: "Most Progress",
    emoji: "📈",
    description: "Największy względny przyrost objętości",
    accentClass: "text-emerald-300",
  },
  longest_streak: {
    label: "Longest Streak",
    emoji: "🔥",
    description: "Najdłuższy ciąg tygodni z treningiem",
    accentClass: "text-orange-300",
  },
  most_helpful: {
    label: "Most Helpful",
    emoji: "🤝",
    description: "Najwięcej pomocy innym w Community",
    accentClass: "text-sky-300",
  },
  challenge_master: {
    label: "Challenge Master",
    emoji: "🏆",
    description: "Najwięcej ukończonych wyzwań",
    accentClass: "text-[var(--gym-gold)]",
  },
  workout_beast: {
    label: "Workout Beast",
    emoji: "💪",
    description: "Najwięcej sesji treningowych",
    accentClass: "text-rose-300",
  },
  community_hero: {
    label: "Community Hero",
    emoji: "⭐",
    description: "Najwięcej Reputation Points w okresie",
    accentClass: "text-[var(--neon)]",
  },
  team_legend: {
    label: "Team Legend",
    emoji: "👑",
    description: "Największy wkład w zespoły",
    accentClass: "text-violet-300",
  },
};

export const HOF_PERIOD_LABELS: Record<HofPeriodKind, string> = {
  week: "Tydzień",
  month: "Miesiąc",
  season: "Sezon",
  year: "Rok",
  all_time: "Wszech czasów",
};

export type HofLeader = {
  userId: string;
  displayName: string;
  rank: number;
  score: number;
  scoreLabel: string;
};

export type HofCategoryBoard = {
  category: HofCategory;
  label: string;
  emoji: string;
  leaders: HofLeader[];
};
