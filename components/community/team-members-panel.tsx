"use client";

import { useActionState, useEffect } from "react";
import {
  changeMemberRoleAction,
  removeMemberAction,
  transferOwnershipAction,
  type TeamActionState,
} from "@/actions/teams";
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
}: {
  teamId: string;
  viewerUserId: string;
  viewerRole: TeamRole;
  members: TeamMemberView[];
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
}: {
  teamId: string;
  viewerUserId: string;
  viewerRole: TeamRole;
  member: TeamMemberView;
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
          <p className="truncate text-[15px] font-semibold text-white">
            {member.displayName}
            {member.userId === viewerUserId ? " (Ty)" : ""}
          </p>
          <p className="mt-0.5 text-[12px] text-white/45">
            {teamRoleLabel(member.role)}
          </p>
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
              Przekaż Owner
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
