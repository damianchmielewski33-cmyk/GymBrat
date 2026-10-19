"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { followAction, unfollowAction } from "@/actions/community-social";

export function PublicProfileActions({
  userId,
  isSelf,
  following,
  friendship,
}: {
  userId: string;
  isSelf: boolean;
  following: boolean;
  friendship: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (isSelf) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (following) await unfollowAction(userId);
            else await followAction(userId);
            router.refresh();
          })
        }
        className="rounded-xl border border-white/20 bg-white/5 px-3.5 py-2 text-[12px] text-white disabled:opacity-50"
      >
        {following ? "Przestań obserwować" : "Obserwuj"}
      </button>
      {friendship === "accepted" ? (
        <span className="rounded-xl border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 px-3.5 py-2 text-[12px] text-[var(--gym-gold)]">
          Znajomi
        </span>
      ) : (
        <span className="rounded-xl border border-white/10 px-3.5 py-2 text-[12px] text-white/40">
          Relacja: {friendship}
        </span>
      )}
    </div>
  );
}
