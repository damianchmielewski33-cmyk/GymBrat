"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import {
  acceptInvitation,
  archiveTeam,
  changeMemberRole,
  createEmailInvitation,
  createTeam,
  declineInvitation,
  joinPublicTeam,
  joinTeamByCode,
  leaveTeam,
  regenerateInviteCode,
  removeMember,
  revokeInvitation,
  transferOwnership,
  updateTeamSettings,
} from "@/lib/community/teams";
import {
  ASSIGNABLE_ROLES,
  TEAM_PRIVACY,
  TEAM_RANKING_METRICS,
} from "@/lib/community/team-types";
import { UserMessages } from "@/lib/user-facing-errors";

export type TeamActionState = {
  ok?: boolean;
  error?: string;
  teamId?: string;
  inviteCode?: string;
  token?: string;
};

function revalidateTeamPaths(teamId?: string) {
  revalidatePath("/community/teams");
  if (teamId) {
    revalidatePath(`/community/teams/${teamId}`);
    revalidatePath(`/community/teams/${teamId}/members`);
    revalidatePath(`/community/teams/${teamId}/settings`);
  }
}

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false as const, error: UserMessages.sessionExpired };
  }
  return {
    ok: true as const,
    userId: session.user.id,
    email: session.user.email ?? "",
  };
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional(),
  privacy: z.enum(TEAM_PRIVACY),
  avatarEmoji: z.string().trim().max(8).optional(),
  rankingMetric: z.enum(TEAM_RANKING_METRICS).optional(),
});

export async function createTeamAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    privacy: formData.get("privacy"),
    avatarEmoji: formData.get("avatarEmoji") || undefined,
    rankingMetric: formData.get("rankingMetric") || undefined,
  });
  if (!parsed.success) {
    return { error: "Sprawdź nazwę, opis i ustawienia prywatności grupy." };
  }

  const result = await createTeam(user.userId, parsed.data);
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(result.teamId);
  return {
    ok: true,
    teamId: result.teamId,
    inviteCode: result.inviteCode,
  };
}

export async function joinTeamByCodeAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const code = String(formData.get("code") ?? "");
  const result = await joinTeamByCode(user.userId, code);
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(result.teamId);
  return { ok: true, teamId: result.teamId };
}

export async function joinPublicTeamAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) return { error: "Brak identyfikatora grupy." };
  const result = await joinPublicTeam(user.userId, teamId);
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(result.teamId);
  return { ok: true, teamId: result.teamId };
}

export async function leaveTeamAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const teamId = String(formData.get("teamId") ?? "");
  const result = await leaveTeam(user.userId, teamId);
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(teamId);
  return { ok: true, teamId };
}

export async function updateTeamSettingsAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const teamId = String(formData.get("teamId") ?? "");
  const privacyRaw = formData.get("privacy");
  const metricRaw = formData.get("rankingMetric");
  const result = await updateTeamSettings(user.userId, teamId, {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    privacy:
      privacyRaw === "public" || privacyRaw === "private"
        ? privacyRaw
        : undefined,
    avatarEmoji: String(formData.get("avatarEmoji") ?? ""),
    bannerColor: String(formData.get("bannerColor") ?? ""),
    rankingMetric:
      metricRaw === "sessions" ||
      metricRaw === "tonnage" ||
      metricRaw === "cardio"
        ? metricRaw
        : undefined,
  });
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(teamId);
  return { ok: true, teamId };
}

export async function regenerateInviteCodeAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const teamId = String(formData.get("teamId") ?? "");
  const result = await regenerateInviteCode(user.userId, teamId);
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(teamId);
  return { ok: true, teamId, inviteCode: result.inviteCode };
}

export async function inviteByEmailAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const teamId = String(formData.get("teamId") ?? "");
  const email = String(formData.get("email") ?? "");
  const roleRaw = String(formData.get("role") ?? "member");
  const role = (ASSIGNABLE_ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as (typeof ASSIGNABLE_ROLES)[number])
    : "member";
  const result = await createEmailInvitation(user.userId, teamId, email, role);
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(teamId);
  return { ok: true, teamId, token: result.token, inviteCode: result.inviteCode };
}

export async function acceptInviteAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const token = String(formData.get("token") ?? "");
  const result = await acceptInvitation(user.userId, user.email, token);
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(result.teamId);
  return { ok: true, teamId: result.teamId };
}

export async function declineInviteAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const token = String(formData.get("token") ?? "");
  const result = await declineInvitation(user.userId, user.email, token);
  if (!result.ok) return { error: result.error };
  revalidatePath("/community/teams");
  return { ok: true };
}

export async function revokeInviteAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const teamId = String(formData.get("teamId") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");
  const result = await revokeInvitation(user.userId, teamId, invitationId);
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(teamId);
  return { ok: true, teamId };
}

export async function changeMemberRoleAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const teamId = String(formData.get("teamId") ?? "");
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  if (!(ASSIGNABLE_ROLES as readonly string[]).includes(roleRaw)) {
    return { error: "Nieprawidłowa rola." };
  }
  const result = await changeMemberRole(
    user.userId,
    teamId,
    targetUserId,
    roleRaw as (typeof ASSIGNABLE_ROLES)[number],
  );
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(teamId);
  return { ok: true, teamId };
}

export async function removeMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const teamId = String(formData.get("teamId") ?? "");
  const targetUserId = String(formData.get("targetUserId") ?? "");
  const result = await removeMember(user.userId, teamId, targetUserId);
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(teamId);
  return { ok: true, teamId };
}

export async function transferOwnershipAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const teamId = String(formData.get("teamId") ?? "");
  const newOwnerUserId = String(formData.get("newOwnerUserId") ?? "");
  const result = await transferOwnership(user.userId, teamId, newOwnerUserId);
  if (!result.ok) return { error: result.error };
  revalidateTeamPaths(teamId);
  return { ok: true, teamId };
}

export async function archiveTeamAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const user = await requireUser();
  if (!user.ok) return { error: user.error };
  const teamId = String(formData.get("teamId") ?? "");
  const result = await archiveTeam(user.userId, teamId);
  if (!result.ok) return { error: result.error };
  revalidatePath("/community/teams");
  return { ok: true };
}
