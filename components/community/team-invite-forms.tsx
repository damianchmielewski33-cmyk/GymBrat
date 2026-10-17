"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  acceptInviteAction,
  declineInviteAction,
  inviteByEmailAction,
  joinPublicTeamAction,
  regenerateInviteCodeAction,
  revokeInviteAction,
  type TeamActionState,
} from "@/actions/teams";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { screenInputClass } from "@/components/layout/screen";
import { cn } from "@/lib/utils";

export function JoinPublicTeamButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction, pending] = useActionState(
    joinPublicTeamAction,
    {} as TeamActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok && state.teamId) {
      notifySaved("Dołączono do grupy");
      router.push(`/community/teams/${state.teamId}`);
      router.refresh();
    }
  }, [state, notifyError, notifySaved, router]);

  return (
    <form action={formAction}>
      <input type="hidden" name="teamId" value={teamId} />
      <Button type="submit" variant="cta" className="w-full" disabled={pending}>
        {pending ? "Dołączanie…" : "Dołącz"}
      </Button>
    </form>
  );
}

export function InviteByEmailForm({ teamId }: { teamId: string }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction, pending] = useActionState(
    inviteByEmailAction,
    {} as TeamActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok) notifySaved("Zaproszenie wysłane");
  }, [state, notifyError, notifySaved]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="teamId" value={teamId} />
      <div className="space-y-2">
        <Label htmlFor="email">E-mail zawodnika</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="np. anna@email.com"
          className={cn(screenInputClass)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Rola po dołączeniu</Label>
        <select
          id="role"
          name="role"
          defaultValue="member"
          className={cn(
            screenInputClass,
            "flex w-full rounded-2xl border px-3 text-sm",
          )}
        >
          <option value="member">Członek</option>
          <option value="moderator">Moderator</option>
          <option value="admin">Administrator</option>
        </select>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Wysyłanie…" : "Zaproś e-mailem"}
      </Button>
    </form>
  );
}

export function RegenerateCodeButton({ teamId }: { teamId: string }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction, pending] = useActionState(
    regenerateInviteCodeAction,
    {} as TeamActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok && state.inviteCode) {
      notifySaved(`Nowy kod: ${state.inviteCode}`);
    }
  }, [state, notifyError, notifySaved]);

  return (
    <form action={formAction}>
      <input type="hidden" name="teamId" value={teamId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "…" : "Nowy kod"}
      </Button>
    </form>
  );
}

export function PendingInviteActions({
  token,
}: {
  token: string;
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptInviteAction,
    {} as TeamActionState,
  );
  const [declineState, declineAction, declinePending] = useActionState(
    declineInviteAction,
    {} as TeamActionState,
  );

  useEffect(() => {
    if (acceptState.error) notifyError(acceptState.error);
    if (acceptState.ok && acceptState.teamId) {
      notifySaved("Dołączono do grupy");
      router.push(`/community/teams/${acceptState.teamId}`);
    }
  }, [acceptState, notifyError, notifySaved, router]);

  useEffect(() => {
    if (declineState.error) notifyError(declineState.error);
    if (declineState.ok) notifySaved("Zaproszenie odrzucone");
  }, [declineState, notifyError, notifySaved]);

  return (
    <div className="flex w-full gap-2">
      <form action={acceptAction} className="min-w-0 flex-1">
        <input type="hidden" name="token" value={token} />
        <Button
          type="submit"
          className="min-h-11 w-full"
          disabled={acceptPending}
        >
          Akceptuj
        </Button>
      </form>
      <form action={declineAction} className="min-w-0 flex-1">
        <input type="hidden" name="token" value={token} />
        <Button
          type="submit"
          variant="outline"
          className="min-h-11 w-full"
          disabled={declinePending}
        >
          Odrzuć
        </Button>
      </form>
    </div>
  );
}

export function RevokeInviteButton({
  teamId,
  invitationId,
}: {
  teamId: string;
  invitationId: string;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction, pending] = useActionState(
    revokeInviteAction,
    {} as TeamActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok) notifySaved("Zaproszenie anulowane");
  }, [state, notifyError, notifySaved]);

  return (
    <form action={formAction}>
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Anuluj
      </Button>
    </form>
  );
}
