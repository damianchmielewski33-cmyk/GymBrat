export const CHALLENGE_SCOPES = [
  "individual",
  "group",
  "seasonal",
  "global",
] as const;
export type ChallengeScope = (typeof CHALLENGE_SCOPES)[number];

export const CHALLENGE_METRICS = [
  "sessions",
  "distance_km",
  "reps",
  "sets",
  "tonnage_kg",
  "cardio_minutes",
] as const;
export type ChallengeMetricKind = (typeof CHALLENGE_METRICS)[number];

export type ChallengeMetricFilter = {
  exerciseKeywords?: string[];
};

export type ChallengeTemplate = {
  key: string;
  title: string;
  description: string;
  emoji: string;
  scope: ChallengeScope;
  metricKind: ChallengeMetricKind;
  metricFilter: ChallengeMetricFilter;
  targetValue: number;
  unitLabel: string;
  rewardXp: number;
  rewardBadgeKey: string;
  rewardTitle: string;
  /** Dni trwania — null = bez limitu (oprócz seasonal default 90). */
  durationDays: number | null;
};

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    key: "sessions_50",
    title: "50 treningów",
    description: "Zaliczyć 50 sesji siłowych lub cardio w okresie wyzwania.",
    emoji: "🏋️",
    scope: "individual",
    metricKind: "sessions",
    metricFilter: {},
    targetValue: 50,
    unitLabel: "treningów",
    rewardXp: 500,
    rewardBadgeKey: "badge_sessions_50",
    rewardTitle: "Maszyna treningowa",
    durationDays: 90,
  },
  {
    key: "run_100km",
    title: "100 km biegu",
    description: "Zbierz 100 km dystansu z cardio (bieg / rower / marsz).",
    emoji: "🏃",
    scope: "individual",
    metricKind: "distance_km",
    metricFilter: {},
    targetValue: 100,
    unitLabel: "km",
    rewardXp: 600,
    rewardBadgeKey: "badge_run_100",
    rewardTitle: "Setka kilometrów",
    durationDays: 90,
  },
  {
    key: "pushups_10k",
    title: "10 000 pompek",
    description: "Suma powtórzeń w ćwiczeniach typu pompka / push-up.",
    emoji: "💪",
    scope: "group",
    metricKind: "reps",
    metricFilter: {
      exerciseKeywords: [
        "pompka",
        "pompki",
        "pushup",
        "push-up",
        "push up",
        "push ups",
      ],
    },
    targetValue: 10_000,
    unitLabel: "pompek",
    rewardXp: 800,
    rewardBadgeKey: "badge_pushups_10k",
    rewardTitle: "Żelazne ręce",
    durationDays: 120,
  },
  {
    key: "leg_sets_500",
    title: "500 serii nóg",
    description: "Zaliczone serie przysiadów, wykroków, ud i bioder.",
    emoji: "🦵",
    scope: "group",
    metricKind: "sets",
    metricFilter: {
      exerciseKeywords: [
        "nog",
        "przysiad",
        "squat",
        "wykrok",
        "lunge",
        "udo",
        "leg",
        "hip thrust",
        "martwy",
        "deadlift",
        "rumuński",
        "rdl",
        "leg press",
        "hack squat",
        "łydk",
        "calf",
      ],
    },
    targetValue: 500,
    unitLabel: "serii",
    rewardXp: 700,
    rewardBadgeKey: "badge_legs_500",
    rewardTitle: "Nogi ze stali",
    durationDays: 90,
  },
  {
    key: "seasonal_sessions_30",
    title: "Sezon: 30 treningów",
    description: "Sezonowe wyzwanie — 30 sesji w 30 dni.",
    emoji: "📅",
    scope: "seasonal",
    metricKind: "sessions",
    metricFilter: {},
    targetValue: 30,
    unitLabel: "treningów",
    rewardXp: 400,
    rewardBadgeKey: "badge_season_30",
    rewardTitle: "Sezonowy wojownik",
    durationDays: 30,
  },
  {
    key: "global_tonnage_1m",
    title: "Globalnie: 1 000 000 kg",
    description: "Cała społeczność GymBrat wspólnie podnosi milion kilogramów.",
    emoji: "🌍",
    scope: "global",
    metricKind: "tonnage_kg",
    metricFilter: {},
    targetValue: 1_000_000,
    unitLabel: "kg",
    rewardXp: 250,
    rewardBadgeKey: "badge_global_1m",
    rewardTitle: "Cząstka miliona",
    durationDays: 365,
  },
];

export function isChallengeScope(v: string): v is ChallengeScope {
  return (CHALLENGE_SCOPES as readonly string[]).includes(v);
}

export function isChallengeMetric(v: string): v is ChallengeMetricKind {
  return (CHALLENGE_METRICS as readonly string[]).includes(v);
}

export function challengeScopeLabel(scope: ChallengeScope): string {
  switch (scope) {
    case "individual":
      return "Indywidualne";
    case "group":
      return "Grupowe";
    case "seasonal":
      return "Sezonowe";
    case "global":
      return "Globalne";
  }
}

export {
  xpLevelFromTotal,
  xpProgressInLevel,
} from "@/lib/community/progression-curve";
