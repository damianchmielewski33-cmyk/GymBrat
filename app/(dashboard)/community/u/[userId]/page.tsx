import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { ActivityFeedList } from "@/components/community/activity-feed-list";
import { PublicProfileActions } from "@/components/community/public-profile-actions";
import { getUserProfileFeed } from "@/lib/community/activity-feed";
import { getFollowCounts, isFollowing } from "@/lib/community/follows";
import { getFriendshipRelation } from "@/lib/community/friendships";
import { getUserProgressionView } from "@/lib/community/progression";
import { getUserReputation } from "@/lib/community/reputation";
import {
  canViewProfile,
  getPublicUserCard,
} from "@/lib/community/social-profile";
import { ReputationBadge } from "@/components/community/reputation-badge";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  const viewerId = session?.user?.id;
  if (!viewerId) redirect("/login");
  const { userId } = await params;

  const card = await getPublicUserCard(userId);
  if (!card) redirect("/community/discover");

  const access = await canViewProfile(viewerId, userId);
  const [counts, following, relation, reputation, progression, feed] =
    await Promise.all([
      getFollowCounts(userId),
      isFollowing(viewerId, userId),
      getFriendshipRelation(viewerId, userId),
      getUserReputation(userId),
      getUserProgressionView(userId),
      getUserProfileFeed(userId, access),
    ]);

  return (
    <div className="space-y-5">
      <Link
        href="/community/discover"
        className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Odkrywaj
      </Link>

      <header
        className={`relative overflow-hidden rounded-2xl border border-white/10 p-5 ${
          progression.auraKey
            ? "bg-gradient-to-br from-[var(--neon)]/15 via-black/50 to-transparent"
            : "bg-black/40"
        }`}
      >
        <h1 className="font-heading text-[28px] font-semibold text-white">
          {card.displayName}
        </h1>
        {card.bio && access === "full" ? (
          <p className="mt-2 text-[14px] text-white/55">{card.bio}</p>
        ) : null}
        {access === "teaser" ? (
          <p className="mt-2 text-[13px] text-white/45">
            Profil ograniczony — zaproś do znajomych lub obserwuj (gdy publiczny).
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ReputationBadge reputation={reputation} />
          <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-white/60">
            Lv. {progression.level}
            {progression.prestigeLabel
              ? ` · ${progression.prestigeLabel}`
              : ""}
          </span>
          <span className="text-[12px] text-white/40">
            {counts.followers} obserwujących · {counts.following} obserwuje
          </span>
        </div>
        <div className="mt-4">
          <PublicProfileActions
            userId={userId}
            isSelf={viewerId === userId}
            following={following}
            friendship={relation}
          />
        </div>
      </header>

      {access === "full" ? (
        <section className="space-y-3">
          <h2 className="font-heading text-[17px] font-semibold text-white">
            Aktywność
          </h2>
          <ActivityFeedList posts={feed} empty="Brak aktywności." />
        </section>
      ) : null}
    </div>
  );
}
