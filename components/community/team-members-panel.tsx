"use client";

import { useActionState, useEffect } from "react";
import {
  changeMemberRoleAction,
  removeMemberAction,
  transferOwnershipAction,
  type TeamActionState,
} from "@/actions/teams";
import { AddFriendFromTeamButton } from "@/components/community/add-friend-from-team-button";
import {
  ReputationBadge,
  ReputationExclusiveMark,
} from "@/components/community/reputation-badge";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import {
  canChangeMemberRole,
  canRemoveMember,
  canTransferOwnership,
} from "@/lib/community/team-permissions";
import type { TeamMemberView } from "@/lib/community/teams";
import {
  ASSIGNABLE_ROLES,
  teamRoleLabel,
  type TeamRole,
} from "@/lib/community/team-types";
import { screenInputClass } from "@/components/layout/screen";
import { cn } from "@/lib/utils";

export function TeamMembersPanel({
  teamId,
  viewerUserId,
  viewerRole,
  members,
  friendshipStatusByUserId = {},
}: {
  teamId: string;
  viewerUserId: string;
  viewerRole: TeamRole;
  members: TeamMemberView[];
  friendshipStatusByUserId?: Record<string, "none" | "pending" | "accepted" | "blocked">;
}) {
  return (
    <div className="space-y-3">
      {members.map((member) => (
        <MemberRow
          key={member.userId}
          teamId={teamId}
          viewerUserId={viewerUserId}
          viewerRole={viewerRole}
          member={member}
          friendshipStatus={
            friendshipStatusByUserId[member.userId] ?? "none"
          }
        />
      ))}
    </div>
  );
}

function MemberRow({
  teamId,
  viewerUserId,
  viewerRole,
  member,
  friendshipStatus,
}: {
  teamId: string;
  viewerUserId: string;
  viewerRole: TeamRole;
  member: TeamMemberView;
  friendshipStatus: "none" | "pending" | "accepted" | "blocked";
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [roleState, roleAction, rolePending] = useActionState(
    changeMemberRoleAction,
    {} as TeamActionState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMemberAction,
    {} as TeamActionState,
  );
  const [transferState, transferAction, transferPending] = useActionState(
    transferOwnershipAction,
    {} as TeamActionState,
  );

  useEffect(() => {
    if (roleState.error) notifyError(roleState.error);
    if (roleState.ok) notifySaved("Rola zaktualizowana");
  }, [roleState, notifyError, notifySaved]);

  useEffect(() => {
    if (removeState.error) notifyError(removeState.error);
    if (removeState.ok) notifySaved("Usunięto z grupy");
  }, [removeState, notifyError, notifySaved]);

  useEffect(() => {
    if (transferState.error) notifyError(transferState.error);
    if (transferState.ok) notifySaved("Własność przekazana");
  }, [transferState, notifyError, notifySaved]);

  const showRoleSelect = ASSIGNABLE_ROLES.some((role) =>
    canChangeMemberRole(viewerRole, member.role, role),
  );
  const showRemove = canRemoveMember(
    viewerRole,
    member.role,
    viewerUserId,
    member.userId,
  );
  const showTransfer =
    canTransferOwnership(viewerRole) &&
    member.userId !== viewerUserId &&
    member.role !== "owner";

  return (
    <div className="app-card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 truncate text-[15px] font-semibold text-white">
            <span className="truncate">
              {member.displayName}
              {member.userId === viewerUserId ? " (Ty)" : ""}
            </span>
            <ReputationExclusiveMark reputation={member.reputation} />
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {member.reputation ? (
              <ReputationBadge reputation={member.reputation} size="xs" />
            ) : null}
            <p className="text-[12px] text-white/45">
              {teamRoleLabel(member.role)}
            </p>
          </div>
        </div>
      </div>

      {showRoleSelect ? (
        <form action={roleAction} className="flex gap-2">
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="targetUserId" value={member.userId} />
          <select
            name="role"
            defaultValue={
              member.role === "owner" ? "admin" : member.role
            }
            className={cn(
              screenInputClass,
              "min-h-10 flex-1 rounded-xl border px-3 text-sm",
            )}
            disabled={rolePending}
          >
            {ASSIGNABLE_ROLES.filter((role) =>
              canChangeMemberRole(viewerRole, member.role, role),
            ).map((role) => (
              <option key={role} value={role}>
                {teamRoleLabel(role)}
              </option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={rolePending}>
            Zapisz
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {member.userId !== viewerUserId && friendshipStatus === "none" ? (
          <AddFriendFromTeamButton otherUserId={member.userId} />
        ) : null}
        {member.userId !== viewerUserId && friendshipStatus === "pending" ? (
          <span className="inline-flex min-h-10 items-center rounded-xl border border-white/10 px-3 text-[12px] text-white/45">
            Zaproszenie wysłane
          </span>
        ) : null}
        {member.userId !== viewerUserId && friendshipStatus === "accepted" ? (
          <span className="inline-flex min-h-10 items-center rounded-xl border border-[var(--gym-gold)]/20 bg-[var(--gym-gold)]/10 px-3 text-[12px] text-[var(--gym-gold)]">
            Znajomy
          </span>
        ) : null}
        {showTransfer ? (
          <form action={transferAction}>
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="newOwnerUserId" value={member.userId} />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={transferPending}
            >
              Przekaż własność
            </Button>
          </form>
        ) : null}
        {showRemove ? (
          <form action={removeAction}>
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="targetUserId" value={member.userId} />
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={removePending}
            >
              Usuń
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
