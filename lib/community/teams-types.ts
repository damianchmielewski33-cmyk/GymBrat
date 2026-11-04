import { type AssignableTeamRole, type TeamPrivacy, type TeamRankingMetric, type TeamRole } from "@/lib/community/team-types";

export type TeamListItem = {
  id: string;
  name: string;
  description: string;
  privacy: TeamPrivacy;
  avatarEmoji: string;
  bannerColor: string;
  memberCount: number;
  maxMembers: number;
  myRole: TeamRole | null;
  isMember: boolean;
};

export type TeamMemberView = {
  membershipId: string;
  userId: string;
  role: TeamRole;
  displayName: string;
  joinedAt: Date;
  reputation?: import("@/lib/community/reputation").ReputationPublic;
};

export type TeamInviteView = {
  id: string;
  inviteeEmail: string | null;
  inviteeUserId: string | null;
  inviteeName: string | null;
  role: AssignableTeamRole;
  status: string;
  createdAt: Date;
  expiresAt: Date;
  token: string;
};

export type TeamRankingRow = {
  userId: string;
  displayName: string;
  score: number;
  rank: number;
  metric: TeamRankingMetric;
  /** Tylko przy metric=fcs — rozbicie 0–1. */
  components?: import("@/lib/community/fcs").FcsComponents;
  newcomerBoost?: number;
};

export type TeamLiveMember = {
  userId: string;
  displayName: string;
  updatedAt: Date | null;
};

export type TeamLiveGroupSession = {
  id: string;
  title: string;
  hostUserId: string;
  createdAt: Date;
};

export type TeamDetailView = {
  id: string;
  name: string;
  description: string;
  privacy: TeamPrivacy;
  avatarEmoji: string;
  bannerColor: string;
  inviteCode: string | null;
  rankingMetric: TeamRankingMetric;
  maxMembers: number;
  memberCount: number;
  createdAt: Date;
  myRole: TeamRole | null;
  isMember: boolean;
  canManage: boolean;
  canInvite: boolean;
  members: TeamMemberView[];
  pendingInvites: TeamInviteView[];
  ranking: TeamRankingRow[];
  liveNow: TeamLiveMember[];
  liveGroupSessions: TeamLiveGroupSession[];
  achievementSummaries: Array<{ id: string; title: string; detail: string }>;
};

export type PublicTeamRow = {
  id: string;
  name: string;
  description: string;
  privacy: string;
  avatarEmoji: string;
  bannerColor: string;
  memberCount: number;
  maxMembers: number;
};

export type CreateTeamInput = {
  name: string;
  description?: string;
  privacy: TeamPrivacy;
  avatarEmoji?: string;
  rankingMetric?: TeamRankingMetric;
};
