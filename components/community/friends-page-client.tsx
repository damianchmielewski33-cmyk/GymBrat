"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Eye, UserPlus } from "lucide-react";
import {
  acceptFriendshipAction,
  declineFriendshipAction,
  removeFriendshipAction,
  requestFriendshipByEmailAction,
  setShareWorkoutAction,
  type FriendshipActionState,
} from "@/actions/friendships";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import type {
  FriendListItem,
  FriendPendingItem,
} from "@/lib/community/friend-types";
import { useFriendLiveWatchStore } from "@/lib/stores/friend-live-watch";
import { cn } from "@/lib/utils";

export function FriendsPageClient({
  friends,
  pending,
}: {
  friends: FriendListItem[];
  pending: FriendPendingItem[];
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const setWatching = useFriendLiveWatchStore((s) => s.setWatching);
  const [inviteState, inviteAction, invitePending] = useActionState(
    requestFriendshipByEmailAction,
    {} as FriendshipActionState,
  );

  useEffect(() => {
    if (inviteState.error) notifyError(inviteState.error);
    if (inviteState.ok) notifySaved("Zaproszenie wysłane");
  }, [inviteState, notifyError, notifySaved]);

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="invite-email-heading">
        <h2 id="invite-email-heading" className="app-label text-[var(--gym-gold)]">
          Dodaj e-mailem
        </h2>
        <form action={inviteAction} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="friend-email" className="sr-only">
            E-mail konta GymBrat
          </label>
          <input
            id="friend-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="email@przyklad.pl"
            className="min-h-12 flex-1 rounded-2xl border border-white/20 bg-black/50 px-4 text-base text-white placeholder:text-white/40 outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45 sm:text-sm"
          />
          <Button
            type="submit"
            variant="cta"
            className="min-h-12 gap-2 sm:min-w-[10rem]"
            disabled={invitePending}
            aria-busy={invitePending}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            {invitePending ? "Wysyłanie…" : "Zaproś"}
          </Button>
        </form>
        <p className="text-[12px] text-white/40">
          Zaproszenie tylko do istniejącego konta. Możesz też dodać kogoś z listy
          członków grupy.
        </p>
      </section>

      {pending.length > 0 ? (
        <section className="space-y-3" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="app-label text-[var(--gym-gold)]">
            Oczekujące
          </h2>
          {pending.map((p) => (
            <PendingRow key={p.friendshipId} item={p} />
          ))}
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="friends-heading">
        <h2 id="friends-heading" className="app-label text-[var(--gym-gold)]">
          Znajomi
        </h2>
        {friends.length === 0 ? (
          <InlineBanner variant="info">
            Brak znajomych — zaproś e-mailem albo z grupy. Po akceptacji włączcie
            oboje „Udostępniaj trening”, żeby podglądać sesje bez dołączania.
          </InlineBanner>
        ) : (
          <ul className="space-y-3">
            {friends.map((f) => (
              <li key={f.friendshipId} className="app-card space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-white">
                      {f.displayName}
                      {f.isLive ? (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                          Na żywo
                        </span>
                      ) : null}
                    </p>
                    {f.email ? (
                      <p className="mt-0.5 truncate text-[12px] text-white/40">
                        {f.email}
                      </p>
                    ) : null}
                  </div>
                  {f.mutualShare && f.isLive ? (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setWatching(f.userId, f.displayName)}
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "min-h-10 gap-1.5 px-3 text-[12px]",
                        )}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden />
                        Podgląd
                      </button>
                      <Link
                        href={`/community/friends/${f.userId}/live`}
                        className={cn(
                          buttonVariants({ variant: "cta" }),
                          "min-h-10 px-3 text-[12px]",
                        )}
                      >
                        Szczegóły
                      </Link>
                    </div>
                  ) : null}
                </div>

                <ShareToggle
                  friendshipId={f.friendshipId}
                  iShare={f.iShareWorkout}
                  theyShare={f.theyShareWorkout}
                  mutual={f.mutualShare}
                />

                <RemoveFriendButton friendshipId={f.friendshipId} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PendingRow({ item }: { item: FriendPendingItem }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptFriendshipAction,
    {} as FriendshipActionState,
  );
  const [declineState, declineAction, declinePending] = useActionState(
    declineFriendshipAction,
    {} as FriendshipActionState,
  );

  useEffect(() => {
    if (acceptState.error) notifyError(acceptState.error);
    if (acceptState.ok) notifySaved("Dodano znajomego");
  }, [acceptState, notifyError, notifySaved]);

  useEffect(() => {
    if (declineState.error) notifyError(declineState.error);
    if (declineState.ok) notifySaved("Odrzucono");
  }, [declineState, notifyError, notifySaved]);

  return (
    <div className="app-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-white">
          {item.displayName}
        </p>
        <p className="mt-0.5 text-[12px] text-white/45">
          {item.outgoing
            ? "Wysłane — czekasz na akceptację"
            : "Chce Cię dodać do znajomych"}
        </p>
      </div>
      {item.outgoing ? (
        <form action={declineAction}>
          <input type="hidden" name="friendshipId" value={item.friendshipId} />
          <Button
            type="submit"
            variant="outline"
            className="min-h-10"
            disabled={declinePending}
          >
            Anuluj
          </Button>
        </form>
      ) : (
        <div className="flex gap-2">
          <form action={declineAction}>
            <input type="hidden" name="friendshipId" value={item.friendshipId} />
            <Button
              type="submit"
              variant="outline"
              className="min-h-10"
              disabled={declinePending}
            >
              Odrzuć
            </Button>
          </form>
          <form action={acceptAction}>
            <input type="hidden" name="friendshipId" value={item.friendshipId} />
            <Button
              type="submit"
              variant="cta"
              className="min-h-10"
              disabled={acceptPending}
            >
              Akceptuj
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

function ShareToggle({
  friendshipId,
  iShare,
  theyShare,
  mutual,
}: {
  friendshipId: string;
  iShare: boolean;
  theyShare: boolean;
  mutual: boolean;
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, action, pending] = useActionState(
    setShareWorkoutAction,
    {} as FriendshipActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok) notifySaved("Zapisano udostępnianie");
  }, [state, notifyError, notifySaved]);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <form action={action} className="flex items-center justify-between gap-3">
        <input type="hidden" name="friendshipId" value={friendshipId} />
        <input type="hidden" name="enabled" value={iShare ? "0" : "1"} />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-white">
            Udostępniaj trening
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {mutual
              ? "Wzajemnie włączone — możecie się podglądać."
              : theyShare
                ? "Oni już udostępniają — włącz u siebie, żeby zobaczyć ich trening."
                : iShare
                  ? "Czekasz, aż znajomy też włączy udostępnianie."
                  : "Oboje musicie włączyć, żeby podgląd działał."}
          </p>
        </div>
        <Button
          type="submit"
          variant={iShare ? "cta" : "outline"}
          className="min-h-10 shrink-0 px-3 text-[12px]"
          disabled={pending}
          aria-pressed={iShare}
        >
          {iShare ? "Włączone" : "Wyłączone"}
        </Button>
      </form>
    </div>
  );
}

function RemoveFriendButton({ friendshipId }: { friendshipId: string }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, action, pending] = useActionState(
    removeFriendshipAction,
    {} as FriendshipActionState,
  );

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok) notifySaved("Usunięto znajomego");
  }, [state, notifyError, notifySaved]);

  return (
    <form action={action}>
      <input type="hidden" name="friendshipId" value={friendshipId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[12px] text-white/35 underline-offset-2 hover:text-white/60 hover:underline"
      >
        Usuń znajomego
      </button>
    </form>
  );
}
