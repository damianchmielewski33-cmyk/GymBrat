import type { ChallengeMetricFilter, ChallengeMetricKind } from "@/lib/community/challenge-types";

export const TEAM_QUEST_STATUSES = ["active", "completed", "expired"] as const;
export type TeamQuestStatus = (typeof TEAM_QUEST_STATUSES)[number];

export type TeamQuestTemplate = {
  key: string;
  title: string;
  description: string;
  emoji: string;
  metricKind: ChallengeMetricKind;
  metricFilter: ChallengeMetricFilter;
  targetValue: number;
  unitLabel: string;
  durationDays: number;
  rewardXpEach: number;
  rewardBadgeKey: string;
  rewardTitle: string;
};

export const TEAM_QUEST_TEMPLATES: TeamQuestTemplate[] = [
  {
    key: "quest_sessions_100w",
    title: "100 treningów tygodniowo",
    description: "Cały zespół — 100 sesji w 7 dni.",
    emoji: "🏋️",
    metricKind: "sessions",
    metricFilter: {},
    targetValue: 100,
    unitLabel: "treningów",
    durationDays: 7,
    rewardXpEach: 120,
    rewardBadgeKey: "quest_sessions_100w",
    rewardTitle: "Tygodniowa maszyna",
  },
  {
    key: "quest_run_500km",
    title: "500 km biegu",
    description: "Wspólnie zbierzcie 500 km cardio.",
    emoji: "🏃",
    metricKind: "distance_km",
    metricFilter: {},
    targetValue: 500,
    unitLabel: "km",
    durationDays: 30,
    rewardXpEach: 200,
    rewardBadgeKey: "quest_run_500",
    rewardTitle: "Pół tysiąca km",
  },
  {
    key: "quest_reps_20k",
    title: "20 000 powtórzeń",
    description: "Suma powtórzeń całego zespołu.",
    emoji: "🔢",
    metricKind: "reps",
    metricFilter: {},
    targetValue: 20_000,
    unitLabel: "powtórzeń",
    durationDays: 14,
    rewardXpEach: 150,
    rewardBadgeKey: "quest_reps_20k",
    rewardTitle: "Rep machine",
  },
  {
    key: "quest_hours_100",
    title: "100 godzin treningu",
    description: "Cardio + czas sesji ≈ 100 h.",
    emoji: "⏱️",
    metricKind: "cardio_minutes",
    metricFilter: {},
    targetValue: 6000,
    unitLabel: "min",
    durationDays: 30,
    rewardXpEach: 180,
    rewardBadgeKey: "quest_hours_100",
    rewardTitle: "Sto godzin",
  },
  {
    key: "quest_leg_sets_500",
    title: "500 serii nóg",
    description: "Serie przysiadów, wykroków i ud.",
    emoji: "🦵",
    metricKind: "sets",
    metricFilter: {
      exerciseKeywords: [
        "przysiad",
        "squat",
        "wykrok",
        "lunge",
        "leg",
        "udo",
        "biodr",
        "deadlift",
        "martwy",
      ],
    },
    targetValue: 500,
    unitLabel: "serii",
    durationDays: 21,
    rewardXpEach: 160,
    rewardBadgeKey: "quest_leg_sets_500",
    rewardTitle: "Nogi ze stali",
  },
];

export function getQuestTemplate(key: string): TeamQuestTemplate | undefined {
  return TEAM_QUEST_TEMPLATES.find((t) => t.key === key);
}
