import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CommunityHubTabs } from "@/components/community/community-hub-tabs";
import { ActivityFeedList } from "@/components/community/activity-feed-list";
import { getGlobalFeed } from "@/lib/community/activity-feed";

export const metadata = { title: "Ranking globalny" };

export default async function GlobalCommunityPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const feed = await getGlobalFeed(50);

  return (
    <div className="space-y-5">
      <header>
        <p className="app-label text-[var(--gym-gold)]">Społeczność</p>
        <h1 className="text-[length:var(--text-title-lg)] mt-1.5 font-heading font-semibold text-white">
          Global GymBrat
        </h1>
        <p className="mt-2 text-[13px] text-white/50">
          Publiczna aktywność społeczności — treningi, osiągnięcia, wojny.
        </p>
      </header>
      <CommunityHubTabs />
      <ActivityFeedList posts={feed} empty="Nikt jeszcze nie udostępnił publicznej aktywności." />
    </div>
  );
}
