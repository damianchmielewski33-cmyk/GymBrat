/**
 * GymBrat Community — PostHog event plan
 *
 * Konwencje PostHog:
 * - nazwy: snake_case, wzorzec `community_<obiekt>_<akcja>`
 * - properties: snake_case
 * - distinct_id = Auth.js userId
 * - grupa PostHog: `$groups.team` = team_id (gdy dotyczy)
 *
 * Wszystkie eventy mutacji emitujemy server-side (source of truth).
 * View eventy (ranking / HoF) mogą iść z klienta.
 */

/** Prefiks produktu — łatwy filtr w PostHog. */
export const COMMUNITY_EVENT_PREFIX = "community_" as const;

export const CommunityEvents = {
  // —— Teams ——
  teamCreated: "community_team_created",
  teamJoined: "community_team_joined",

  // —— Feed ——
  postPublished: "community_post_published",
  postReacted: "community_post_reacted",
  postCommented: "community_post_commented",

  // —— Challenges ——
  challengeCreated: "community_challenge_created",
  challengeJoined: "community_challenge_joined",
  challengeCompleted: "community_challenge_completed",

  // —— Live training ——
  liveStarted: "community_live_started",
  liveJoined: "community_live_joined",
  liveEnded: "community_live_ended",

  // —— Ranking ——
  rankingViewed: "community_ranking_viewed",
  rankingLeaderChanged: "community_ranking_leader_changed",

  // —— Hall of Fame ——
  hofViewed: "community_hof_viewed",
  hofAwarded: "community_hof_awarded",
} as const;

export type CommunityEventName =
  (typeof CommunityEvents)[keyof typeof CommunityEvents];

export type TeamJoinMethod = "code" | "public" | "invite";

export type ReactionAction = "add" | "change" | "remove";

/** Wspólne pola na każdym evencie Community (dokładane w track). */
export type CommunityBaseProps = {
  /** Wersja schematu eventów — bump przy breaking change properties. */
  analytics_schema: 1;
  surface: "community";
};

export type CommunityEventProps = {
  [CommunityEvents.teamCreated]: {
    team_id: string;
    privacy: "public" | "private";
    ranking_metric: string;
    member_count: number;
  };
  [CommunityEvents.teamJoined]: {
    team_id: string;
    join_method: TeamJoinMethod;
    already_member: boolean;
    privacy?: "public" | "private";
  };
  [CommunityEvents.postPublished]: {
    team_id: string;
    post_id: string;
    post_type: string;
    has_media: boolean;
    media_count: number;
    body_length: number;
    is_auto: boolean;
    mention_count: number;
  };
  [CommunityEvents.postReacted]: {
    team_id: string;
    post_id: string;
    reaction_kind: string | null;
    action: ReactionAction;
  };
  [CommunityEvents.postCommented]: {
    team_id: string;
    post_id: string;
    comment_id: string;
    is_reply: boolean;
    mention_count: number;
    body_length: number;
  };
  [CommunityEvents.challengeCreated]: {
    challenge_id: string;
    team_id: string | null;
    template_key: string;
    scope: string;
    metric_kind: string;
    target_value: number;
    duration_days: number | null;
  };
  [CommunityEvents.challengeJoined]: {
    challenge_id: string;
    team_id: string | null;
    scope: string;
    template_key: string | null;
  };
  [CommunityEvents.challengeCompleted]: {
    challenge_id: string;
    team_id: string | null;
    template_key: string | null;
    scope: string;
    xp_awarded: number;
    badge_key: string | null;
  };
  [CommunityEvents.liveStarted]: {
    session_id: string;
    team_id: string;
  };
  [CommunityEvents.liveJoined]: {
    session_id: string;
    team_id: string;
  };
  [CommunityEvents.liveEnded]: {
    session_id: string;
    team_id: string;
    ended_by: "host" | "leave";
    participant_count?: number;
  };
  [CommunityEvents.rankingViewed]: {
    team_id: string;
    week_key?: string | null;
    ranking_metric?: string | null;
    ranking_size?: number;
  };
  [CommunityEvents.rankingLeaderChanged]: {
    team_id: string;
    week_key: string;
    score_label: string;
    top_display_name: string;
  };
  [CommunityEvents.hofViewed]: {
    season_key?: string | null;
    team_id?: string | null;
  };
  [CommunityEvents.hofAwarded]: {
    season_key: string;
    category_label: string;
    team_id?: string | null;
  };
};

/** Dokumentacja pod PostHog (Insights / Data Management). */
export const COMMUNITY_EVENT_PLAN: Array<{
  event: CommunityEventName;
  description: string;
  required: string[];
  optional?: string[];
  group?: "team";
}> = [
  {
    event: CommunityEvents.teamCreated,
    description: "Użytkownik utworzył nową grupę Team.",
    required: ["team_id", "privacy", "ranking_metric", "member_count"],
    group: "team",
  },
  {
    event: CommunityEvents.teamJoined,
    description: "Dołączenie do grupy (kod / publiczna / zaproszenie).",
    required: ["team_id", "join_method", "already_member"],
    optional: ["privacy"],
    group: "team",
  },
  {
    event: CommunityEvents.postPublished,
    description: "Publikacja posta na Team Feed (ręczna lub auto).",
    required: [
      "team_id",
      "post_id",
      "post_type",
      "has_media",
      "media_count",
      "body_length",
      "is_auto",
      "mention_count",
    ],
    group: "team",
  },
  {
    event: CommunityEvents.postReacted,
    description: "Reakcja na post (add / change / remove).",
    required: ["team_id", "post_id", "reaction_kind", "action"],
    group: "team",
  },
  {
    event: CommunityEvents.postCommented,
    description: "Komentarz lub odpowiedź pod postem.",
    required: [
      "team_id",
      "post_id",
      "comment_id",
      "is_reply",
      "mention_count",
      "body_length",
    ],
    group: "team",
  },
  {
    event: CommunityEvents.challengeCreated,
    description: "Utworzenie wyzwania z szablonu.",
    required: [
      "challenge_id",
      "team_id",
      "template_key",
      "scope",
      "metric_kind",
      "target_value",
      "duration_days",
    ],
    group: "team",
  },
  {
    event: CommunityEvents.challengeJoined,
    description: "Dołączenie użytkownika do wyzwania.",
    required: ["challenge_id", "team_id", "scope", "template_key"],
    group: "team",
  },
  {
    event: CommunityEvents.challengeCompleted,
    description: "Ukończenie wyzwania (XP / odznaka).",
    required: [
      "challenge_id",
      "team_id",
      "template_key",
      "scope",
      "xp_awarded",
      "badge_key",
    ],
    group: "team",
  },
  {
    event: CommunityEvents.liveStarted,
    description: "Start live treningu grupowego (host).",
    required: ["session_id", "team_id"],
    group: "team",
  },
  {
    event: CommunityEvents.liveJoined,
    description: "Dołączenie do live treningu grupowego.",
    required: ["session_id", "team_id"],
    group: "team",
  },
  {
    event: CommunityEvents.liveEnded,
    description: "Zakończenie / opuszczenie sesji live.",
    required: ["session_id", "team_id", "ended_by"],
    optional: ["participant_count"],
    group: "team",
  },
  {
    event: CommunityEvents.rankingViewed,
    description: "Wyświetlenie rankingu tygodnia na ekranie Team.",
    required: ["team_id"],
    optional: ["week_key", "ranking_metric", "ranking_size"],
    group: "team",
  },
  {
    event: CommunityEvents.rankingLeaderChanged,
    description: "Zmiana lidera rankingu (emit przy powiadomieniu).",
    required: ["team_id", "week_key", "score_label", "top_display_name"],
    group: "team",
  },
  {
    event: CommunityEvents.hofViewed,
    description: "Wejście na Hall of Fame.",
    required: [],
    optional: ["season_key", "team_id"],
  },
  {
    event: CommunityEvents.hofAwarded,
    description: "Przyznanie miejsca w Hall of Fame.",
    required: ["season_key", "category_label"],
    optional: ["team_id"],
    group: "team",
  },
];
