import {
  TEAM_ROLE_RANK,
  type AssignableTeamRole,
  type TeamRole,
} from "@/lib/community/team-types";

export function canManageTeamSettings(role: TeamRole | null): boolean {
  return role === "owner" || role === "admin";
}

export function canInviteMembers(role: TeamRole | null): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}

export function canRegenerateInviteCode(role: TeamRole | null): boolean {
  return role === "owner" || role === "admin";
}

export function canChangeMemberRole(
  actorRole: TeamRole | null,
  targetRole: TeamRole,
  nextRole: AssignableTeamRole,
): boolean {
  if (!actorRole) return false;
  if (targetRole === "owner") return false;
  if (nextRole === "admin" && actorRole !== "owner") return false;
  if (actorRole === "owner") return true;
  if (actorRole === "admin") {
    return (
      TEAM_ROLE_RANK[targetRole] < TEAM_ROLE_RANK.admin &&
      TEAM_ROLE_RANK[nextRole] < TEAM_ROLE_RANK.admin
    );
  }
  return false;
}

export function canRemoveMember(
  actorRole: TeamRole | null,
  targetRole: TeamRole,
  actorUserId: string,
  targetUserId: string,
): boolean {
  if (!actorRole) return false;
  if (actorUserId === targetUserId) return false;
  if (targetRole === "owner") return false;
  if (actorRole === "owner") return true;
  if (actorRole === "admin") {
    return TEAM_ROLE_RANK[targetRole] < TEAM_ROLE_RANK.admin;
  }
  if (actorRole === "moderator") {
    return targetRole === "member";
  }
  return false;
}

export function canArchiveTeam(role: TeamRole | null): boolean {
  return role === "owner";
}

export function canTransferOwnership(role: TeamRole | null): boolean {
  return role === "owner";
}

export function canViewPrivateTeam(
  privacy: "public" | "private",
  membershipRole: TeamRole | null,
): boolean {
  if (privacy === "public") return true;
  return membershipRole != null;
}
