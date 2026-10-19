import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CommunityHubTabs } from "@/components/community/community-hub-tabs";
import { DiscoverView } from "@/components/community/discover-view";
import { listPublicTeams } from "@/lib/community/discover";

export default async function DiscoverPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const teams = await listPublicTeams(20);

  return (
    <div className="space-y-5">
      <header>
        <p className="app-label text-[var(--gym-gold)]">Społeczność</p>
        <h1 className="mt-1.5 font-heading text-[26px] font-semibold text-white">
          Odkrywaj
        </h1>
        <p className="mt-2 text-[13px] text-white/45">
          Szukaj atletów i publicznych grup GymBrat.
        </p>
      </header>
      <CommunityHubTabs />
      <DiscoverView initialTeams={teams} />
    </div>
  );
}
