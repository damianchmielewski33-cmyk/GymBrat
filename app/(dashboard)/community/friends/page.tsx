import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { auth } from "@/auth";
import { ActivityFeedList } from "@/components/community/activity-feed-list";
import { CommunityHubTabs } from "@/components/community/community-hub-tabs";
import { FriendsPageClient } from "@/components/community/friends-page-client";
import { AppPageHeader } from "@/components/layout/screen";
import { getFriendsFeed } from "@/lib/community/activity-feed";
import { listFriendsAndPending } from "@/lib/community/friendships";

export default async function CommunityFriendsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const [{ friends, pending }, feed] = await Promise.all([
    listFriendsAndPending(userId),
    getFriendsFeed(userId, 40),
  ]);

  return (
    <div className="space-y-6 pb-8">
      <AppPageHeader
        kicker="Społeczność"
        title="Znajomi"
        description="Wzajemne udostępnianie treningu, live i feed aktywności znajomych."
      />
      <CommunityHubTabs />
      <FriendsPageClient friends={friends} pending={pending} />
      <section className="space-y-3">
        <h2 className="font-heading text-[17px] font-semibold text-white">
          Feed znajomych
        </h2>
        <ActivityFeedList
          posts={feed}
          empty="Gdy znajomi będą aktywni, zobaczysz tu ich postępy."
        />
      </section>
      {friends.length === 0 && pending.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] text-white/40">
          <UserPlus className="h-4 w-4" aria-hidden />
          Wskazówka: na liście członków grupy też jest „Dodaj do znajomych”.
        </p>
      ) : null}
    </div>
  );
}
