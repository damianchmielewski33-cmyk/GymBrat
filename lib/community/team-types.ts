export const TEAM_ROLES = ["owner", "admin", "moderator", "member"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_PRIVACY = ["public", "private"] as const;
export type TeamPrivacy = (typeof TEAM_PRIVACY)[number];

export const TEAM_MEMBER_STATUSES = [
  "active",
  "invited",
  "left",
  "banned",
] as const;
export type TeamMemberStatus = (typeof TEAM_MEMBER_STATUSES)[number];

export const TEAM_INVITE_STATUSES = [
  "pending",
  "accepted",
  "declined",
  "revoked",
  "expired",
] as const;
export type TeamInviteStatus = (typeof TEAM_INVITE_STATUSES)[number];

export const TEAM_RANKING_METRICS = [
  "sessions",
  "tonnage",
  "cardio",
] as const;
export type TeamRankingMetric = (typeof TEAM_RANKING_METRICS)[number];

export const TEAM_ROLE_RANK: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
};

export const ASSIGNABLE_ROLES = ["admin", "moderator", "member"] as const;
export type AssignableTeamRole = (typeof ASSIGNABLE_ROLES)[number];

export function isTeamRole(value: string): value is TeamRole {
  return (TEAM_ROLES as readonly string[]).includes(value);
}

export function isAssignableTeamRole(value: string): value is AssignableTeamRole {
  return (ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

export function teamRoleLabel(role: TeamRole): string {
  switch (role) {
    case "owner":
      return "Właściciel";
    case "admin":
      return "Administrator";
    case "moderator":
      return "Moderator";
    case "member":
      return "Członek";
  }
}

export function teamPrivacyLabel(privacy: TeamPrivacy): string {
  return privacy === "public" ? "Publiczna" : "Prywatna";
}
