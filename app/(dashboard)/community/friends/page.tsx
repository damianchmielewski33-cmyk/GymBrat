import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { auth } from "@/auth";
import { FriendsPageClient } from "@/components/community/friends-page-client";
import { AppPageHeader } from "@/components/layout/screen";
import { listFriendsAndPending } from "@/lib/community/friendships";

export default async function CommunityFriendsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const { friends, pending } = await listFriendsAndPending(userId);

  return (
    <div className="space-y-6 pb-8">
      <AppPageHeader
        kicker="Społeczność"
        title="Znajomi"
        description="Wzajemne udostępnianie treningu — podgląd bez dołączania do sesji. Gdy zaczniesz trenować, znajomy dostanie powiadomienie."
      />
      <FriendsPageClient friends={friends} pending={pending} />
      {friends.length === 0 && pending.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] text-white/40">
          <UserPlus className="h-4 w-4" aria-hidden />
          Wskazówka: na liście członków grupy też jest „Dodaj do znajomych”.
        </p>
      ) : null}
    </div>
  );
}
