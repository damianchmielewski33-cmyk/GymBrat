import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { FriendLiveDetailClient } from "@/components/community/friend-live-detail-client";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { canWatchFriendLive } from "@/lib/community/friendships";

export default async function FriendLivePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  const viewerId = session?.user?.id;
  if (!viewerId) redirect("/login");

  const { userId: subjectId } = await params;
  if (!subjectId || subjectId === viewerId) {
    redirect("/community/friends");
  }

  const allowed = await canWatchFriendLive(viewerId, subjectId);
  const db = getDb();
  const [row] = await db
    .select({
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, subjectId))
    .limit(1);

  const initialName = row
    ? [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
      row.name?.trim() ||
      row.email.split("@")[0] ||
      "Znajomy"
    : "Znajomy";

  // Strona renderuje się nawet bez mutual share — klient pokaże forbidden UI.
  void allowed;

  return (
    <FriendLiveDetailClient
      subjectUserId={subjectId}
      initialName={initialName}
    />
  );
}
