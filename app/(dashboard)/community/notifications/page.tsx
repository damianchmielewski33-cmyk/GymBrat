import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NotificationCenterClient } from "@/components/community/notification-center";

export default async function CommunityNotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <NotificationCenterClient />;
}
