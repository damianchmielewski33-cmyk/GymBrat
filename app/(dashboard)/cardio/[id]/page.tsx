import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { CardioDetailClient } from "@/components/cardio/cardio-detail-client";
import { getCardioActivity } from "@/lib/cardio-queries";

export default async function CardioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const activity = await getCardioActivity(session.user.id, id);
  if (!activity) notFound();

  return (
    <CardioDetailClient
      id={activity.id}
      date={activity.date}
      minutes={activity.minutes}
      payload={activity.payload}
      paceMinPerKm={activity.paceMinPerKm}
      hasDevicePhoto={activity.hasDevicePhoto}
    />
  );
}
