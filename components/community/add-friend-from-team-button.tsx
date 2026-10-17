"use client";

import { useActionState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import {
  requestFriendshipFromTeamAction,
  type FriendshipActionState,
} from "@/actions/friendships";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";

export function AddFriendFromTeamButton({
  otherUserId,
  disabled,
  label = "Dodaj do znajomych",
}: {
  otherUserId: string;
  disabled?: boolean;
  label?: string;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, action, pending] = useActionState(
    requestFriendshipFromTeamAction,
    {} as FriendshipActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok) notifySaved("Zaproszenie do znajomych wysłane");
  }, [state, notifyError, notifySaved]);

  if (disabled) return null;

  return (
    <form action={action}>
      <input type="hidden" name="otherUserId" value={otherUserId} />
      <Button
        type="submit"
        variant="outline"
        className="min-h-10 gap-1.5 px-3 text-[12px]"
        disabled={pending}
        aria-busy={pending}
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden />
        {pending ? "…" : label}
      </Button>
    </form>
  );
}
